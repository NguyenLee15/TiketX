using MediatR;
using TickeX.Domain.Enums;

namespace TickeX.Application.Tickets.Queries;

public record TicketDto(
    Guid Id, 
    Guid EventId, 
    Guid SeatId,
    string EventTitle, 
    string EventDescription,
    DateTime EventDate, 
    DateTime EndDate,
    string Location, 
    string VenueName,
    string Category,
    string ImageUrl,
    string Row, 
    int Number, 
    SeatTier Tier,
    decimal Price, 
    string Status,
    long OrderCode,
    string QrCodeSignature,
    DateTime? PaidAt,
    DateTime? CheckedInAt,
    decimal? RefundAmount,
    DateTime? RefundedAt,
    int RefundCutoffHours,
    bool CanRefund,
    string? RefundStatus = null
);

public record GetMyTicketsQuery(Guid UserId, int? Page = null, int? PageSize = null, string? Status = null) : IRequest<List<TicketDto>>;
