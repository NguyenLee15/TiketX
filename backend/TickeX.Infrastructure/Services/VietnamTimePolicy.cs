using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class VietnamTimePolicy : ITimePolicy
{
    private static readonly TimeZoneInfo VietnamZone = ResolveZone();

    public DateTime UtcNow => DateTime.UtcNow;
    public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, VietnamZone);

    public DateTime ToLocal(DateTime utc)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), VietnamZone);

    public DateTime ToUtc(DateTime local)
        => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), VietnamZone);

    public DateTime LocalDateStart(DateTime utc)
    {
        var local = ToLocal(utc).Date;
        return ToUtc(local);
    }

    private static TimeZoneInfo ResolveZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
    }
}
