using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Seats.Commands;

public sealed class LockSeatCommandHandler : IRequestHandler<LockSeatCommand, ReservationResult>
{
    private readonly IReservationOperations _operations;
    public LockSeatCommandHandler(IReservationOperations operations) => _operations = operations;
    public Task<ReservationResult> Handle(LockSeatCommand request, CancellationToken cancellationToken) =>
        _operations.ReserveAsync(request.EventId, request.SeatId, request.UserId, request.Version, cancellationToken);
}
