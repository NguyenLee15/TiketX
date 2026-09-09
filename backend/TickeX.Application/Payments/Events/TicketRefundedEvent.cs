namespace TickeX.Application.Payments.Events;

public record TicketRefundedEvent(Guid TicketId, Guid UserId, Guid EventId, decimal RefundAmount, DateTime RefundedAt);
