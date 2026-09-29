using MediatR;
using TickeX.Domain.Enums;

namespace TickeX.Application.Tickets.Commands;

public record CheckInTicketCommand(
    string QrToken, 
    Guid StaffUserId, 
    string StaffRole = "Staff", 
    string StaffEmail = "staff@tickex.com",
    string? IpAddress = null
) : IRequest<CheckInResult>;

public record CheckInResult(
    bool Success, 
    string Message, 
    TicketCheckInDetails? Ticket = null,
    int StatusCode = 200,
    string? Code = null
);

public record TicketCheckInDetails(
    Guid TicketId,
    Guid EventId,
    string EventTitle,
    string AttendeeName,
    string AttendeeEmail,
    string Row,
    int Number,
    SeatTier Tier,
    decimal Price,
    long OrderCode,
    DateTime CheckedInAt
);
