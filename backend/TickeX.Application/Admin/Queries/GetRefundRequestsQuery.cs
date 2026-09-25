using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Admin.Queries;

public sealed record GetRefundRequestsQuery(int Page = 1, int PageSize = 25) : IRequest<RefundRequestPage>;
public sealed record RefundRequestRow(Guid Id, Guid EventId, Guid TicketId, decimal Amount, string Status, int Attempts, string? ProviderStatus, string? ProviderReference, string? LastError, DateTime CreatedAt, DateTime? NextAttemptAt);
public sealed record RefundRequestPage(IReadOnlyList<RefundRequestRow> Items, int Page, int PageSize, int TotalCount);

public sealed class GetRefundRequestsQueryHandler(IApplicationDbContext context) : IRequestHandler<GetRefundRequestsQuery, RefundRequestPage>
{
    public async Task<RefundRequestPage> Handle(GetRefundRequestsQuery request, CancellationToken cancellationToken)
    {
        if (request.Page < 1 || request.PageSize is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(request), "page must be positive and pageSize must be between 1 and 100.");
        var query = context.RefundRequests.AsNoTracking().OrderByDescending(x => x.CreatedAt);
        var count = await query.CountAsync(cancellationToken);
        var items = await query.Skip(checked((request.Page - 1) * request.PageSize)).Take(request.PageSize)
            .Select(x => new RefundRequestRow(x.Id, x.EventId, x.TicketId, x.Amount, x.Status, x.AttemptCount, x.ProviderStatus, x.ProviderReference, x.LastError, x.CreatedAt, x.NextAttemptAt))
            .ToListAsync(cancellationToken);
        return new RefundRequestPage(items, request.Page, request.PageSize, count);
    }
}
