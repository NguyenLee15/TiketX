using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Services;

public class JwtService : IJwtService
{
    private readonly IConfiguration _configuration;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role ?? "Customer"),
            new Claim("SecurityStamp", user.SecurityStamp ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var activeKeyId = _configuration["Jwt:ActiveKeyId"];
        var signingKey = !string.IsNullOrWhiteSpace(activeKeyId)
            ? _configuration[$"Jwt:SigningKeys:{activeKeyId}"]
            : null;

        SigningCredentials creds;
        if (!string.IsNullOrWhiteSpace(activeKeyId) && !string.IsNullOrWhiteSpace(signingKey))
        {
            var key = JwtKeyMaterial.LoadPrivateKey(signingKey, activeKeyId);
            creds = new SigningCredentials(key, SecurityAlgorithms.RsaSha256);
        }
        else
        {
            var jwtKey = _configuration["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(jwtKey))
                throw new InvalidOperationException("Jwt RSA signing key must be configured before issuing tokens.");

            var key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey));
            creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        }

        var accessTokenMinutes = _configuration.GetValue("Jwt:AccessTokenMinutes", 15);
        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "TickeX",
            audience: _configuration["Jwt:Audience"] ?? "TickeXClient",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(accessTokenMinutes),
            signingCredentials: creds
        );

        if (!string.IsNullOrWhiteSpace(activeKeyId) && !string.IsNullOrWhiteSpace(signingKey))
            token.Header[JwtHeaderParameterNames.Kid] = activeKeyId;

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
