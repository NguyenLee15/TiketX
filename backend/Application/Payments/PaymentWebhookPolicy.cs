using TickeX.Application.Interfaces;

namespace TickeX.Application.Payments;

public static class PaymentWebhookPolicy
{
    public static string ProviderTransactionId(PayOSWebhookData data) =>
        !string.IsNullOrWhiteSpace(data.Reference)
            ? data.Reference
            : !string.IsNullOrWhiteSpace(data.PaymentLinkId)
                ? data.PaymentLinkId
                : data.OrderCode.ToString();

    public static string AuditSummary(PayOSWebhookData data, string providerTransactionId) =>
        PaymentAudit.CreateWebhookSummary(data.OrderCode, data.Amount, providerTransactionId, data.Code);

    public static bool IsAmountValid(decimal expectedAmount, PayOSWebhookData data) =>
        data.Success && data.Amount == expectedAmount;
}
