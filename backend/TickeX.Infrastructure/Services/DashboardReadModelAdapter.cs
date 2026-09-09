using TickeX.Application.Admin.Queries;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

/// <summary>
/// Infrastructure adapter for the dashboard read seam. The projection remains
/// reusable by the existing MediatR query while the WebApi resolves the read
/// model through an Infrastructure-owned adapter.
/// </summary>
public sealed class DashboardReadModelAdapter : IDashboardReadModel
{
    private readonly IApplicationDbContext _context;

    public DashboardReadModelAdapter(IApplicationDbContext context)
    {
        _context = context;
    }

    public Task<DashboardStatsResult> GetAsync(CancellationToken cancellationToken)
        => new GetDashboardStatsQueryHandler(_context).GetAsync(cancellationToken);
}
