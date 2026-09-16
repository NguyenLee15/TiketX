using System;
using TickeX.Domain.Entities;
using Xunit;
using FluentAssertions;

namespace TickeX.UnitTests.Payments;

public class ConcurrencyAndPaymentTests
{
    [Fact]
    public void PaymentTransaction_MarkSuccess_ShouldBeIdempotent()
    {
        // Arrange
        var tx = new PaymentTransaction(889911L, Guid.NewGuid(), 250000);

        // Act
        tx.MarkSuccess("TX12345", "{}");
        var firstProcessedAt = tx.ProcessedAt;

        // Second duplicate webhook call
        tx.MarkSuccess("TX12345", "{}");

        // Assert
        tx.Status.Should().Be("Success");
        tx.ProviderTransactionId.Should().Be("TX12345");
        tx.Amount.Should().Be(250000);
    }

    [Fact]
    public void PaymentTransaction_MarkRefundInitiated_And_MarkRefunded_ShouldTransitionProperly()
    {
        // Arrange
        var tx = new PaymentTransaction(889911L, Guid.NewGuid(), 500000);
        tx.MarkSuccess("TX99999", "{}");

        // Act
        tx.MarkRefundInitiated("Refund request received");
        tx.Status.Should().Be("RefundInitiated");

        tx.MarkRefunded("REFUND_TX_001", "Refund completed");

        // Assert
        tx.Status.Should().Be("Refunded");
        tx.ProviderTransactionId.Should().Be("REFUND_TX_001");
    }

    [Fact]
    public void PaymentTransaction_MarkOrphaned_ShouldFlagCompensationState()
    {
        // Arrange
        var tx = new PaymentTransaction(778899L, Guid.NewGuid(), 350000);

        // Act
        tx.MarkOrphaned("Hold expired: Cancelled", "PAYOS_TX_999", "{\"code\":\"00\"}");

        // Assert
        tx.Status.Should().Be("OrphanedPaid");
        tx.ProviderTransactionId.Should().Be("PAYOS_TX_999");
        tx.RawWebhookPayload.Should().Contain("Hold expired: Cancelled");
        tx.Amount.Should().Be(350000);
    }
}
