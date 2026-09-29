namespace TickeX.Application.Seats;

public sealed class ReservationOptions
{
    public const string SectionName = "Reservation";
    public int HoldMinutes { get; set; } = 5;
    public int MaximumPendingSeatsPerEvent { get; set; } = 4;
}
