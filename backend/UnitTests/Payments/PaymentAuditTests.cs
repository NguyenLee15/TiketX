using TickeX.Application.Payments;

namespace TickeX.UnitTests.Payments;

public sealed class PaymentAuditTests
{
    [Fact]
    public void CreateWebhookSummary_keeps_reconciliation_fields_without_sensitive_payload()
    {
        var summary = PaymentAudit.CreateWebhookSummary(
            orderCode: 260915123456789,
            amount: 250000m,
            providerTransactionId: "provider-reference",
            resultCode: "00");

        summary.Should().Be("orderCode=260915123456789;amount=250000;reference=provider-reference;code=00");
        summary.Should().NotContain("account");
        summary.Should().NotContain("signature");
    }

    [Fact]
    public void CreateWebhookSummary_bounds_provider_reference_to_payment_storage_limit()
    {
        var summary = PaymentAudit.CreateWebhookSummary(123, 1m, new string('x', 10_000), "00");

        summary.Length.Should().BeLessThanOrEqualTo(4_000);
    }
}
