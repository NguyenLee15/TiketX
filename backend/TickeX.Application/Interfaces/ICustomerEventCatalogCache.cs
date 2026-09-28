using TickeX.Application.Events.Queries;

namespace TickeX.Application.Interfaces;

public interface ICustomerEventCatalogCache
{
    Task<PagedResult<EventDto>?> GetAsync(GetEventsQuery request, CancellationToken cancellationToken = default);
    Task SetAsync(GetEventsQuery request, PagedResult<EventDto> result, CancellationToken cancellationToken = default);
    Task InvalidateAsync(CancellationToken cancellationToken = default);
}
