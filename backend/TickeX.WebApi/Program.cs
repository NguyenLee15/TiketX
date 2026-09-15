using System.Threading.RateLimiting;
using Hangfire;
using Hangfire.MemoryStorage;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TickeX.Application;
using TickeX.Infrastructure;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using TickeX.WebApi.Health;

var builder = WebApplication.CreateBuilder(args);

static bool IsConfigured(string? value) => !string.IsNullOrWhiteSpace(value)
    && !value.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase)
    && !value.StartsWith("replace-with", StringComparison.OrdinalIgnoreCase);

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1_048_576);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<CookieAuthenticationSettings>(builder.Configuration.GetSection(CookieAuthenticationSettings.SectionName));
builder.Services.AddSignalR();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;

    // Never trust forwarded headers from arbitrary clients. Configure the proxy IPs
    // explicitly in production (ForwardedHeaders:KnownProxies), otherwise the
    // framework keeps the direct connection address as the client identity.
    var configuredProxies = builder.Configuration
        .GetSection("ForwardedHeaders:KnownProxies")
        .Get<string[]>() ?? Array.Empty<string>();

    foreach (var proxy in configuredProxies)
    {
        if (System.Net.IPAddress.TryParse(proxy, out var address))
            options.KnownProxies.Add(address);
    }

    var configuredNetworks = builder.Configuration
        .GetSection("ForwardedHeaders:KnownNetworks")
        .Get<string[]>() ?? Array.Empty<string>();
    foreach (var network in configuredNetworks)
    {
        if (Microsoft.AspNetCore.HttpOverrides.IPNetwork.TryParse(network, out var parsedNetwork))
            options.KnownNetworks.Add(parsedNetwork);
    }
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.Headers.Append("Retry-After", "60");
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            System.Text.Json.JsonSerializer.Serialize(new
            {
                success = false,
                code = "TOO_MANY_REQUESTS",
                message = "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.",
                error = new { code = "TOO_MANY_REQUESTS", message = "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.", details = (object?)null }
            }), token);
    };

    // 1. Auth policy partitioned by authenticated user + trusted client identity.
    options.AddPolicy("AuthPolicy", httpContext =>
    {
        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString();
        var partitionKey = httpContext.RequestServices.GetRequiredService<TickeX.Application.Interfaces.IClientIdentityResolver>()
            .Resolve(userId, clientIp);
        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 15,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });

    // 2. Booking policy partitioned by authenticated user + trusted client identity.
    options.AddPolicy("BookingPolicy", httpContext =>
    {
        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString();
        var partitionKey = httpContext.RequestServices.GetRequiredService<TickeX.Application.Interfaces.IClientIdentityResolver>()
            .Resolve(userId, clientIp);
        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });
});

var hangfireConnection = builder.Configuration.GetConnectionString("HangfireConnection");
if (string.IsNullOrWhiteSpace(hangfireConnection) && !builder.Environment.IsDevelopment())
    throw new InvalidOperationException("ConnectionStrings:HangfireConnection is required outside Development; in-memory Hangfire storage is not safe for production.");
builder.Services.AddHangfire(configuration =>
{
    configuration.SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings();
    if (!string.IsNullOrWhiteSpace(hangfireConnection))
        configuration.UseSqlServerStorage(hangfireConnection);
    else if (builder.Environment.IsDevelopment())
        configuration.UseMemoryStorage();
});

builder.Services.AddHangfireServer();

builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new InvalidOperationException("Jwt:Key is missing. Configure a development or production secret explicitly.");
if (jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key must contain at least 32 characters.");

if (!builder.Environment.IsDevelopment())
{
    var requiredInfrastructure = new[]
    {
        (Name: "ConnectionStrings:DefaultConnection", Value: builder.Configuration.GetConnectionString("DefaultConnection")),
        (Name: "ConnectionStrings:Redis", Value: builder.Configuration.GetConnectionString("Redis")),
        (Name: "ConnectionStrings:HangfireConnection", Value: builder.Configuration.GetConnectionString("HangfireConnection")),
        (Name: "RabbitMQ:HostName", Value: builder.Configuration["RabbitMQ:HostName"]),
        (Name: "RabbitMQ:UserName", Value: builder.Configuration["RabbitMQ:UserName"]),
        (Name: "RabbitMQ:Password", Value: builder.Configuration["RabbitMQ:Password"]),
        (Name: "Smtp:Server", Value: builder.Configuration["Smtp:Server"]),
        (Name: "Smtp:Username", Value: builder.Configuration["Smtp:Username"]),
        (Name: "Smtp:Password", Value: builder.Configuration["Smtp:Password"]),
        (Name: "Smtp:FromEmail", Value: builder.Configuration["Smtp:FromEmail"]),
        (Name: "PayOS:ReturnUrl", Value: builder.Configuration["PayOS:ReturnUrl"]),
        (Name: "PayOS:CancelUrl", Value: builder.Configuration["PayOS:CancelUrl"])
    };
    var missingInfrastructure = requiredInfrastructure.FirstOrDefault(setting => !IsConfigured(setting.Value));
    if (missingInfrastructure != default)
        throw new InvalidOperationException($"{missingInfrastructure.Name} is required outside Development.");

    var payOsSettings = new[]
    {
        (Name: "PayOS:ClientId", Value: builder.Configuration["PayOS:ClientId"]),
        (Name: "PayOS:ApiKey", Value: builder.Configuration["PayOS:ApiKey"]),
        (Name: "PayOS:ChecksumKey", Value: builder.Configuration["PayOS:ChecksumKey"])
    };
    var missingPayOsSetting = payOsSettings.FirstOrDefault(setting =>
        !IsConfigured(setting.Value));
    if (missingPayOsSetting != default)
        throw new InvalidOperationException($"{missingPayOsSetting.Name} is required outside Development.");
    if (!Uri.TryCreate(builder.Configuration["PayOS:ReturnUrl"], UriKind.Absolute, out var returnUri) || returnUri.Scheme != Uri.UriSchemeHttps
        || !Uri.TryCreate(builder.Configuration["PayOS:CancelUrl"], UriKind.Absolute, out var cancelUri) || cancelUri.Scheme != Uri.UriSchemeHttps)
        throw new InvalidOperationException("PayOS return and cancellation URLs must use HTTPS outside Development.");

    var activeTicketKeyId = builder.Configuration["TicketSecurity:ActiveKeyId"];
    var activeTicketKey = string.IsNullOrWhiteSpace(activeTicketKeyId) ? null : builder.Configuration[$"TicketSecurity:SecretKeys:{activeTicketKeyId}"];
    if (!IsConfigured(activeTicketKey))
        throw new InvalidOperationException("An active TicketSecurity signing key is required outside Development.");

    var cookies = builder.Configuration.GetSection(CookieAuthenticationSettings.SectionName).Get<CookieAuthenticationSettings>();
    if (cookies?.Secure != true)
        throw new InvalidOperationException("Authentication:Cookie:Secure must be true outside Development.");
}

builder.Services.AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.Zero,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "TickeX",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "TickeXClient",
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey))
        };

        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // Preserve standard Authorization: Bearer support. Browser sessions
                // receive the same signed access token only from the HttpOnly cookie.
                if (!string.IsNullOrWhiteSpace(context.Request.Headers.Authorization))
                    return Task.CompletedTask;
                if (context.HttpContext.Request.Path.StartsWithSegments("/hubs/seat"))
                {
                    var hubToken = context.Request.Query["access_token"].ToString();
                    if (!string.IsNullOrWhiteSpace(hubToken)) context.Token = hubToken;
                }
                if (string.IsNullOrWhiteSpace(context.Token))
                {
                    var cookieName = builder.Configuration[$"{CookieAuthenticationSettings.SectionName}:AccessCookieName"] ?? "tickex_access";
                    context.Token = context.Request.Cookies[cookieName];
                }
                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var dbContext = context.HttpContext.RequestServices.GetRequiredService<TickeX.Application.Interfaces.IApplicationDbContext>();
                var userIdClaim = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var stampClaim = context.Principal?.FindFirst("SecurityStamp")?.Value;

                if (!Guid.TryParse(userIdClaim, out var userId))
                {
                    context.Fail("Invalid user token claim.");
                    return;
                }

                var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
                    .AsNoTracking(dbContext.Users)
                    .FirstOrDefaultAsync(u => u.Id == userId);

                if (user == null || user.IsBlocked)
                {
                    context.Fail("User not found or blocked.");
                    return;
                }

                if (!string.IsNullOrEmpty(user.SecurityStamp) && user.SecurityStamp != stampClaim)
                {
                    context.Fail("Token revoked due to security state change.");
                    return;
                }
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddHealthChecks()
    .AddCheck<InfrastructureReadinessHealthCheck>("infrastructure", tags: ["ready"]);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
if (builder.Environment.IsDevelopment() && (allowedOrigins is null || allowedOrigins.Length == 0))
    allowedOrigins = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"];
if (!builder.Environment.IsDevelopment() && (allowedOrigins is null || allowedOrigins.Length == 0 || allowedOrigins.Any(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback)))
    throw new InvalidOperationException("Cors:AllowedOrigins must contain explicit non-loopback production origins.");
allowedOrigins ??= Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

var app = builder.Build();

if (args.Contains("--migrate", StringComparer.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var database = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await database.Database.MigrateAsync();
    return;
}

// Local SQLite and seed data are development conveniences. Production migration is
// executed explicitly with `dotnet TickeX.WebApi.dll --migrate` by the release job.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var database = services.GetRequiredService<ApplicationDbContext>();
    if (database.Database.IsSqlite())
    {
        await database.Database.EnsureCreatedAsync();
    }
    else await database.Database.MigrateAsync();
    await DatabaseSeeder.SeedAsync(services, logger);
}

// Configure the HTTP request pipeline.
app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseMiddleware<TickeX.WebApi.Middleware.GlobalExceptionMiddleware>();

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy", "camera=(self), geolocation=(), microphone=()");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';");
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseHangfireDashboard("/hangfire");
}

app.UseCors("AllowFrontend");

app.Use(async (context, next) =>
{
    var cookieSettings = context.RequestServices.GetRequiredService<Microsoft.Extensions.Options.IOptions<CookieAuthenticationSettings>>().Value;
    var isUnsafe = !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method);
    var isCookieAuthenticated = context.Request.Cookies.ContainsKey(cookieSettings.AccessCookieName) &&
        string.IsNullOrWhiteSpace(context.Request.Headers.Authorization);
    var exempt = context.Request.Path.StartsWithSegments("/api/auth/login") ||
        context.Request.Path.StartsWithSegments("/api/auth/register") ||
        context.Request.Path.StartsWithSegments("/api/payments/webhook");
    if (isUnsafe && isCookieAuthenticated && !exempt && !CookieAuthenticationSupport.HasValidCsrfToken(
            context.Request.Cookies[cookieSettings.CsrfCookieName], context.Request.Headers["X-CSRF-TOKEN"].FirstOrDefault()))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { success = false, code = "CSRF_TOKEN_INVALID", message = "Yêu cầu không có CSRF token hợp lệ." });
        return;
    }
    await next();
});

app.UseAuthentication();
// Authenticate before partitioned endpoint rate limits so authenticated
// operations are keyed by user + trusted client IP, not by a shared anonymous bucket.
app.UseRateLimiter();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false
}).AllowAnonymous();
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
}).AllowAnonymous();
app.MapControllers();
app.MapHub<TickeX.Infrastructure.Hubs.SeatHub>("/hubs/seat");

app.Run();
