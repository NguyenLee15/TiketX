using TickeX.Application.Events.Queries;

namespace TickeX.Application.Interfaces;

public interface ICustomerEventCatalog
{
    Task<PagedResult<EventDto>> SearchAsync(GetEventsQuery request, CancellationToken cancellationToken);
}
