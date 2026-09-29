using MediatR;

namespace TickeX.Application.Seats.Commands;

public record ReleaseSeatCommand(Guid TicketId) : IRequest<bool>;
