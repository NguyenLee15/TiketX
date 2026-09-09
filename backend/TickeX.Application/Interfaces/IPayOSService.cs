namespace TickeX.Application.Interfaces;

public class CreatePaymentResult
{
    public string CheckoutUrl { get; set; } = string.Empty;
}

public class PayOSWebhookData
{
    public long OrderCode { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string Reference { get; set; } = string.Empty;
    public string TransactionDateTime { get; set; } = string.Empty;
    public string Currency { get; set; } = "VND";
    public string PaymentLinkId { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string RawPayload { get; set; } = string.Empty;
}

public interface IPayOSService
{
    Task<CreatePaymentResult?> CreatePaymentLink(long orderCode, int amount, string description, string returnUrl, string cancelUrl);
    PayOSWebhookData? VerifyPaymentWebhookData(string webhookBody, string signature);
}
