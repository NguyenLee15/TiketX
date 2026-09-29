namespace TickeX.Application.Interfaces;

public interface IClientIdentityResolver
{
    string Resolve(string? userId, string? remoteIpAddress);
}
