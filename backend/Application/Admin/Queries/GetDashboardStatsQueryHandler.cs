using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Admin.Queries;

/// <summary>
/// Thin application entry point. Dashboard projection/query details belong to
/// the read-model Adapter behind IDashboardReadModel.
/// </summary>
public sealed class GetDashboardStatsQueryHandler : IRequestHandler<GetDashboardStatsQuery, DashboardStatsResult>
{
    private readonly IDashboardReadModel _readModel;

    public GetDashboardStatsQueryHandler(IDashboardReadModel readModel)
        => _readModel = readModel;

    public Task<DashboardStatsResult> Handle(GetDashboardStatsQuery request, CancellationToken cancellationToken)
        => _readModel.GetAsync(cancellationToken);
}
