using TickeX.Application.Tickets.Queries;

namespace TickeX.Application.Interfaces;

/// <summary>
/// Read-only customer ticket projection. Persistence details stay in Infrastructure.
/// </summary>
public interface ICustomerTicketReadModel
{
    Task<TicketPage> GetForUserAsync(Guid userId, int? page = null, int? pageSize = null, string? status = null, CancellationToken cancellationToken = default);
}
