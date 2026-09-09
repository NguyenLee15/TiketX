using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Seats.Commands;

public sealed class ReleaseSeatCommandHandler : IRequestHandler<ReleaseSeatCommand, bool>
{
    private readonly IReservationOperations _operations;
    public ReleaseSeatCommandHandler(IReservationOperations operations) => _operations = operations;

    public async Task<bool> Handle(ReleaseSeatCommand request, CancellationToken cancellationToken) =>
        (await _operations.ExpireAsync(request.TicketId, cancellationToken)).Success;
}
