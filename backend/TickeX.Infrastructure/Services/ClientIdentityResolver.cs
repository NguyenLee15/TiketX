using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class ClientIdentityResolver : IClientIdentityResolver
{
    public string Resolve(string? userId, string? remoteIpAddress) =>
        $"{(string.IsNullOrWhiteSpace(userId) ? "anonymous" : userId)}:{(string.IsNullOrWhiteSpace(remoteIpAddress) ? "unknown_ip" : remoteIpAddress)}";
}
