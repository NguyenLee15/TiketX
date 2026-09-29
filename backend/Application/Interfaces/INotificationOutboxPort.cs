namespace TickeX.Application.Interfaces;
public enum NotificationOutboxEnqueueResult { Created, AlreadyExists }
public interface INotificationOutboxPort
{
    Task<NotificationOutboxEnqueueResult> QueueTicketPaidAsync(Guid ticketId, Guid userId, Guid eventId, CancellationToken cancellationToken);
}
