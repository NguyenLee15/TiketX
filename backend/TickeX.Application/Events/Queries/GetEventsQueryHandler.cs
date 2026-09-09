using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Events.Queries;

public sealed class GetEventsQueryHandler : IRequestHandler<GetEventsQuery, PagedResult<EventDto>>
{
    private readonly ICustomerEventCatalog _catalog;

    public GetEventsQueryHandler(ICustomerEventCatalog catalog)
    {
        _catalog = catalog;
    }

    public Task<PagedResult<EventDto>> Handle(GetEventsQuery request, CancellationToken cancellationToken) =>
        _catalog.SearchAsync(request, cancellationToken);
}
