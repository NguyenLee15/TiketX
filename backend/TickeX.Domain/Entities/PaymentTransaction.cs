namespace TickeX.Domain.Entities;

public class PaymentTransaction : BaseEntity
{
    public long OrderCode { get; private set; }
    public Guid TicketId { get; private set; }
    public decimal Amount { get; private set; }
    public string Provider { get; private set; } = "PayOS"; // PayOS, VietQR, etc.
    public string ProviderTransactionId { get; private set; } = string.Empty;
    public string Status { get; private set; } = "Pending"; // Pending, Success, Failed, RefundInitiated, Refunded, RefundFailed
    public string RawWebhookPayload { get; private set; } = string.Empty;
    public string CheckoutUrl { get; private set; } = string.Empty;
    public DateTime ProcessedAt { get; private set; } = DateTime.UtcNow;

    private PaymentTransaction() { } // For EF Core

    public PaymentTransaction(long orderCode, Guid ticketId, decimal amount, string provider = "PayOS")
    {
        OrderCode = orderCode;
        TicketId = ticketId;
        Amount = amount;
        Provider = provider;
        Status = "Pending";
        ProcessedAt = DateTime.UtcNow;
    }

    public void MarkSuccess(string providerTxId, string rawPayload = "")
    {
        Status = "Success";
        ProviderTransactionId = providerTxId;
        RawWebhookPayload = rawPayload;
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetCheckoutUrl(string checkoutUrl)
    {
        CheckoutUrl = checkoutUrl;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkFailed(string reason, string rawPayload = "")
    {
        Status = "Failed";
        RawWebhookPayload = $"{reason} | {rawPayload}";
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkRefundInitiated(string rawPayload = "")
    {
        Status = "RefundInitiated";
        RawWebhookPayload = rawPayload;
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkRefunded(string refundTxId = "", string rawPayload = "")
    {
        Status = "Refunded";
        if (!string.IsNullOrEmpty(refundTxId))
            ProviderTransactionId = refundTxId;
        if (!string.IsNullOrEmpty(rawPayload))
            RawWebhookPayload = rawPayload;
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkRefundFailed(string reason, string rawPayload = "")
    {
        Status = "RefundFailed";
        RawWebhookPayload = $"{reason} | {rawPayload}";
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
