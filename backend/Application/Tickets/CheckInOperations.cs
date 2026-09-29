using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Tickets;

public sealed class CheckInOperations : ICheckInOperations
{
    private readonly IMediator _mediator;

    public CheckInOperations(IMediator mediator) => _mediator = mediator;

    public Task<Commands.CheckInResult> CheckInAsync(Commands.CheckInTicketCommand command, CancellationToken cancellationToken) =>
        _mediator.Send(command, cancellationToken);
}
