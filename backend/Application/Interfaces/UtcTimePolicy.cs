namespace TickeX.Application.Interfaces;

public sealed class UtcTimePolicy : ITimePolicy
{
    public DateTime UtcNow => DateTime.UtcNow;
    public DateTime LocalNow => UtcNow;
    public DateTime ToLocal(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc);
    public DateTime ToUtc(DateTime local) => DateTime.SpecifyKind(local, DateTimeKind.Utc);
    public DateTime LocalDateStart(DateTime utc) => DateTime.SpecifyKind(utc.Date, DateTimeKind.Utc);
}
