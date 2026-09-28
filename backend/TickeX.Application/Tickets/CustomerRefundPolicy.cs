namespace TickeX.Application.Tickets;

public static class CustomerRefundPolicy
{
    public const int DefaultCutoffHours = 24;

    public static int NormalizeCutoffHours(int configuredCutoffHours) =>
        configuredCutoffHours > 0 ? configuredCutoffHours : DefaultCutoffHours;

    public static DateTime GetAllowedUntil(DateTime eventStart, int configuredCutoffHours) =>
        eventStart.AddHours(-NormalizeCutoffHours(configuredCutoffHours));

    public static bool CanRefund(DateTime now, DateTime eventStart, int configuredCutoffHours) =>
        now <= GetAllowedUntil(eventStart, configuredCutoffHours);
}
