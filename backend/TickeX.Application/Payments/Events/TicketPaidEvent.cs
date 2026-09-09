namespace TickeX.Application.Payments.Events;

public record TicketPaidEvent(Guid TicketId, Guid UserId, Guid EventId);
