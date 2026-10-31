using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Admin.Queries;

public sealed record GetRefundRequestsQuery(int Page = 1, int PageSize = 25) : IRequest<RefundRequestPage>;
public sealed record RefundRequestRow(Guid Id, Guid EventId, Guid TicketId, decimal Amount, string Status, int Attempts, string? ProviderStatus, string? ProviderReference, string? LastError, DateTime CreatedAt, DateTime? NextAttemptAt, string? Version = null);
public sealed record RefundRequestPage(IReadOnlyList<RefundRequestRow> Items, int Page, int PageSize, int TotalCount);

public sealed class GetRefundRequestsQueryHandler(IApplicationDbContext context) : IRequestHandler<GetRefundRequestsQuery, RefundRequestPage>
{
    public async Task<RefundRequestPage> Handle(GetRefundRequestsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Clamp(request.Page > 0 ? request.Page : 1, 1, 10000);
        var pageSize = Math.Clamp(request.PageSize > 0 ? request.PageSize : 25, 1, 50);

        var query = context.RefundRequests.AsNoTracking().OrderByDescending(x => x.CreatedAt);
        var count = await query.CountAsync(cancellationToken);
        var rawItems = await query.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.EventId,
                x.TicketId,
                x.Amount,
                x.Status,
                x.AttemptCount,
                x.ProviderStatus,
                x.ProviderReference,
                x.LastError,
                x.CreatedAt,
                x.NextAttemptAt,
                x.Version
            })
            .ToListAsync(cancellationToken);

        var items = rawItems.Select(x => new RefundRequestRow(
            x.Id,
            x.EventId,
            x.TicketId,
            x.Amount,
            x.Status,
            x.AttemptCount,
            x.ProviderStatus,
            x.ProviderReference,
            SanitizeError(x.LastError),
            x.CreatedAt,
            x.NextAttemptAt,
            x.Version != null && x.Version.Length > 0 ? Convert.ToBase64String(x.Version) : null
        )).ToList();

        return new RefundRequestPage(items, page, pageSize, count);
    }

    public static string? SanitizeError(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var firstLine = raw.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Trim();
        if (string.IsNullOrWhiteSpace(firstLine)) return null;
        return firstLine.Length > 200 ? firstLine[..200] + "..." : firstLine;
    }
}
