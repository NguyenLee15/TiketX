using MediatR;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Queries;

public record EventDto(
    Guid Id, 
    string Title, 
    string Description, 
    DateTime Date, 
    DateTime EndDate,
    string Location, 
    string VenueName,
    string Category, 
    string ImageUrl,
    string BannerUrl,
    string OrganizerName,
    int TotalSeats,
    int AvailableSeatsCount,
    decimal BasePrice,
    decimal MinPrice,
    decimal MaxPrice,
    EventStatus Status,
    int RefundCutoffHours,
    bool IsDeleted = false,
    bool HasTicketHistory = false,
    string? Version = null
);

public record PagedResult<T>(List<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / (PageSize > 0 ? PageSize : 10));
}

public record GetEventsQuery(
    string? Search = null,
    string? Category = null,
    DateTime? DateFrom = null,
    DateTime? DateTo = null,
    string? SortBy = null, // "date_asc", "date_desc", "price_asc", "price_desc"
    int Page = 1,
    int PageSize = 12
) : IRequest<PagedResult<EventDto>>;
