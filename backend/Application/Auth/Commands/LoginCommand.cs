using MediatR;

namespace TickeX.Application.Auth.Commands;

public record LoginCommand(string Email, string Password) : IRequest<AuthResult>;
