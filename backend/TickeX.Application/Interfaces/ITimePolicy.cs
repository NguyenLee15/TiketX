namespace TickeX.Application.Interfaces;

public interface ITimePolicy
{
    DateTime UtcNow { get; }
    DateTime LocalNow { get; }
    DateTime ToLocal(DateTime utc);
    DateTime ToUtc(DateTime local);
    DateTime LocalDateStart(DateTime utc);
}
