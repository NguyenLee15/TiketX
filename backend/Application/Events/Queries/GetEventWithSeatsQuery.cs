using MediatR;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Queries;

public record SeatDto(
    Guid Id, 
    Guid EventId, 
    string Row, 
    int Number, 
    SeatTier Tier, 
    SeatStatus Status, 
    decimal Price, 
    string Version,
    bool IsLockedByCurrentUser = false
);

public record EventDetailDto(
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
    List<SeatDto> Seats
);

public record GetEventWithSeatsQuery(Guid EventId, Guid? CurrentUserId = null) : IRequest<EventDetailDto?>;
