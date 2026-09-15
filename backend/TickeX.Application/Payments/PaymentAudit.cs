using System.Globalization;

namespace TickeX.Application.Payments;

public static class PaymentAudit
{
    public static string CreateWebhookSummary(
        long orderCode,
        decimal amount,
        string providerTransactionId,
        string resultCode) =>
        $"orderCode={orderCode};amount={amount.ToString(CultureInfo.InvariantCulture)};reference={Bound(providerTransactionId, 150)};code={Bound(resultCode, 30)}";

    private static string Bound(string value, int maximumLength) =>
        value.Length <= maximumLength ? value : value[..maximumLength];
}
