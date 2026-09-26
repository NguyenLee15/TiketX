using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Seats.Commands;

public sealed class ReleaseSeatCommandHandler : IRequestHandler<ReleaseSeatCommand, bool>
{
    private readonly IReservationOperations _operations;
    public ReleaseSeatCommandHandler(IReservationOperations operations) => _operations = operations;

    public async Task<bool> Handle(ReleaseSeatCommand request, CancellationToken cancellationToken)
    {
        var result = await _operations.ExpireAsync(request.TicketId, cancellationToken);
        if (!result.Success && result.Code is "RESERVATION_LOCK_UNAVAILABLE" or "RESERVATION_LOCK_LOST")
        {
            throw new InvalidOperationException($"Transient lock failure expiring ticket {request.TicketId}: {result.Message}");
        }
        return result.Success;
    }
}
