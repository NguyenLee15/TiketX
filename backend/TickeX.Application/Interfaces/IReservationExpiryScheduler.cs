namespace TickeX.Application.Interfaces;

public interface IReservationExpiryScheduler
{
    void Schedule(Guid ticketId, TimeSpan delay);
}
