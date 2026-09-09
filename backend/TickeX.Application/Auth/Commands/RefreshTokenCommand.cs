using MediatR;

namespace TickeX.Application.Auth.Commands;

public sealed record RefreshTokenCommand(string Token) : IRequest<AuthResult>;
