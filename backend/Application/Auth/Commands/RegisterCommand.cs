using MediatR;

namespace TickeX.Application.Auth.Commands;

public record RegisterCommand(string Name, string Email, string Password) : IRequest<AuthResult>;

public record AuthResult(bool Success, string Token, string Message, Guid? UserId = null, string? Name = null, string? Role = null, string? RefreshToken = null, string? Email = null);
