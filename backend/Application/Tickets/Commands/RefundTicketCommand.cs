using MediatR;

namespace TickeX.Application.Tickets.Commands;

public record RefundTicketCommand(
    Guid TicketId,
    Guid UserId,
    string Reason = "Customer Request",
    string ActorEmail = "",
    string? IpAddress = null) : IRequest<RefundResult>;

public record RefundResult(
    bool Success,
    string Message,
    decimal RefundAmount = 0,
    string? Code = null);
