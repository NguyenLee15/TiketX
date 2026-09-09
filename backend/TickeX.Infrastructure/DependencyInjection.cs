using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TickeX.Application.Interfaces;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using TickeX.Application.Seats;
using TickeX.Application.Admin.Queries;

namespace TickeX.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<ApplicationDbContext>(options =>
        {
            var connStr = configuration.GetConnectionString("DefaultConnection");
            if (connStr != null && (connStr.Contains(".db", StringComparison.OrdinalIgnoreCase) || connStr.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase)))
            {
                options.UseSqlite(connStr, b => b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName));
            }
            else
            {
                options.UseSqlite("Data Source=tickex_local.db", b => b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName));
            }
        });

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
        services.AddScoped<IDashboardReadModel, DashboardReadModelAdapter>();
        services.AddScoped<IRefundRequestPort, RefundRequestPort>();
        services.AddScoped<INotificationOutboxPort, NotificationOutboxPort>();
        services.AddOptions<ReservationOptions>()
            .Bind(configuration.GetSection(ReservationOptions.SectionName))
            .Validate(x => x.HoldMinutes is >= 1 and <= 30, "Reservation:HoldMinutes must be between 1 and 30.")
            .Validate(x => x.MaximumPendingSeatsPerEvent is >= 1 and <= 20, "Reservation:MaximumPendingSeatsPerEvent must be between 1 and 20.")
            .ValidateOnStart();
        services.AddScoped<IReservationOperations, ReservationOperations>();
        services.AddScoped<IReservationExpiryScheduler, HangfireReservationExpiryScheduler>();
        services.AddScoped<ICustomerCheckoutOperations, CustomerCheckoutOperations>();
        services.AddSingleton<IClientIdentityResolver, ClientIdentityResolver>();
        
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IRefreshTokenStore, RefreshTokenStore>();
        services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
        services.AddScoped<ITicketSecurityService, TicketSecurityService>();
        services.AddTransient<IEmailService, EmailService>();
        services.AddScoped<ISeatNotificationService, SeatNotificationService>();

        // Redis Connection with resilient fallback
        var redisConfiguration = configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";
        services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(sp =>
        {
            try
            {
                var options = StackExchange.Redis.ConfigurationOptions.Parse(redisConfiguration);
                options.AbortOnConnectFail = false;
                options.ConnectTimeout = 1000;
                return StackExchange.Redis.ConnectionMultiplexer.Connect(options);
            }
            catch
            {
                var options = new StackExchange.Redis.ConfigurationOptions { AbortOnConnectFail = false };
                return StackExchange.Redis.ConnectionMultiplexer.Connect(options);
            }
        });
            
        services.AddScoped<TickeX.Application.Interfaces.IDistributedLockService, TickeX.Infrastructure.Services.RedisDistributedLockService>();

        // RabbitMQ
        services.AddSingleton<IMessagePublisher, TickeX.Infrastructure.Messaging.RabbitMQPublisher>();
        services.AddHostedService<TickeX.Infrastructure.Messaging.TicketPaidEventConsumer>();
        services.AddHostedService<TickeX.Infrastructure.Messaging.NotificationOutboxDispatcher>();
        
        // PayOS
        services.AddHttpClient<IPayOSService, TickeX.Infrastructure.Payments.PayOSService>();

        return services;
    }
}
