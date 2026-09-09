using MediatR;
using TickeX.Application.Common.Models;
using TickeX.Application.Events.Commands;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Events;

public sealed class AdminEventOperations : IAdminEventOperations
{
    private readonly IMediator _mediator;

    public AdminEventOperations(IMediator mediator) => _mediator = mediator;

    public Task<Guid> CreateAsync(CreateEventCommand command, CancellationToken cancellationToken) =>
        _mediator.Send(command, cancellationToken);

    public Task<AdminOperationResult> UpdateAsync(UpdateEventCommand command, CancellationToken cancellationToken) =>
        _mediator.Send(command, cancellationToken);

    public Task<AdminOperationResult> CancelAsync(CancelEventCommand command, CancellationToken cancellationToken) =>
        _mediator.Send(command, cancellationToken);

    public Task<AdminOperationResult> DeleteAsync(DeleteEventCommand command, CancellationToken cancellationToken) =>
        _mediator.Send(command, cancellationToken);
}
