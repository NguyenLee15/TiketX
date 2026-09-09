using TickeX.Application.Admin.Queries;

namespace TickeX.Application.Interfaces;

/// <summary>
/// Read-only seam for the admin dashboard. Implementations may use a projection
/// or reporting store without changing the HTTP contract.
/// </summary>
public interface IDashboardReadModel
{
    Task<DashboardStatsResult> GetAsync(CancellationToken cancellationToken);
}
