using MediatR;
using TickeX.Application.Common.Models;
using TickeX.Application.Events.Commands;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Events;

public sealed class AdminEventOperations : IAdminEventOperations
{
    private readonly IMediator _mediator;
    private readonly ICustomerEventCatalogCache _catalogCache;

    public AdminEventOperations(IMediator mediator, ICustomerEventCatalogCache catalogCache)
    {
        _mediator = mediator;
        _catalogCache = catalogCache;
    }

    public async Task<Guid> CreateAsync(CreateEventCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        await _catalogCache.InvalidateAsync(cancellationToken);
        return result;
    }

    public async Task<AdminOperationResult> UpdateAsync(UpdateEventCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        if (result.Success) await _catalogCache.InvalidateAsync(cancellationToken);
        return result;
    }

    public async Task<AdminOperationResult> CancelAsync(CancelEventCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        if (result.Success) await _catalogCache.InvalidateAsync(cancellationToken);
        return result;
    }

    public async Task<AdminOperationResult> DeleteAsync(DeleteEventCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        if (result.Success) await _catalogCache.InvalidateAsync(cancellationToken);
        return result;
    }
}
