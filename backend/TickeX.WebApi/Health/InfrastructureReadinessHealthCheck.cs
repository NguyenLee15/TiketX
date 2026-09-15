using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using RabbitMQ.Client;
using StackExchange.Redis;
using TickeX.Infrastructure.Persistence;

namespace TickeX.WebApi.Health;

public sealed class InfrastructureReadinessHealthCheck : IHealthCheck
{
    private readonly ApplicationDbContext _database;
    private readonly IConnectionMultiplexer _redis;
    private readonly IConfiguration _configuration;

    public InfrastructureReadinessHealthCheck(
        ApplicationDbContext database,
        IConnectionMultiplexer redis,
        IConfiguration configuration) => (_database, _redis, _configuration) = (database, redis, configuration);

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!await _database.Database.CanConnectAsync(cancellationToken) || !_redis.IsConnected
                || (await _database.Database.GetPendingMigrationsAsync(cancellationToken)).Any())
                return HealthCheckResult.Unhealthy("A required infrastructure dependency is unavailable.");

            var factory = new ConnectionFactory
            {
                HostName = _configuration["RabbitMQ:HostName"] ?? string.Empty,
                UserName = _configuration["RabbitMQ:UserName"] ?? string.Empty,
                Password = _configuration["RabbitMQ:Password"] ?? string.Empty,
                Port = _configuration.GetValue("RabbitMQ:Port", 5672),
                Ssl = new SslOption { Enabled = _configuration.GetValue("RabbitMQ:UseTls", false) }
            };

            await using var connection = await factory.CreateConnectionAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch
        {
            return HealthCheckResult.Unhealthy("A required infrastructure dependency is unavailable.");
        }
    }
}
