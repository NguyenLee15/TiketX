using System;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using Xunit;
using FluentAssertions;

namespace TickeX.UnitTests.Domain;

public class TicketTests
{
    [Fact]
    public void MarkAsPaid_ShouldUpdateStatusAndPaidAt()
    {
        // Arrange
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 250000);

        // Act
        ticket.MarkAsPaid();

        // Assert
        ticket.Status.Should().Be(TicketStatus.Paid);
        ticket.PaidAt.Should().NotBeNull();
        ticket.PaidAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void MarkAsPaid_ShouldPreserveQrSignatureWhenCalledWithoutToken()
    {
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 250000);
        const string qrSignature = "signed-qr-token";

        ticket.SetQrSignature(qrSignature);
        ticket.MarkAsPaid();

        ticket.QrCodeSignature.Should().Be(qrSignature);
    }

    [Fact]
    public void MarkAsPaid_ShouldStoreProvidedQrSignature()
    {
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 250000);

        ticket.MarkAsPaid("signed-qr-token");

        ticket.QrCodeSignature.Should().Be("signed-qr-token");
    }

    [Fact]
    public void Refund_WhenPaid_ShouldUpdateStatusToCancelledAndRecordRefundAmount()
    {
        // Arrange
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 500000);
        ticket.MarkAsPaid();

        // Act
        ticket.Refund(500000);

        // Assert
        ticket.Status.Should().Be(TicketStatus.Cancelled);
        ticket.RefundAmount.Should().Be(500000);
        ticket.RefundedAt.Should().NotBeNull();
    }

    [Fact]
    public void CheckIn_WhenPaid_ShouldUpdateStatusToUsedAndRecordTimestamp()
    {
        // Arrange
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 200000);
        ticket.MarkAsPaid();

        // Act
        ticket.CheckIn();

        // Assert
        ticket.Status.Should().Be(TicketStatus.Used);
        ticket.CheckedInAt.Should().NotBeNull();
    }

    [Fact]
    public void CheckIn_WhenTicketIsPending_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 200000);

        // Act
        Action act = () => ticket.CheckIn();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Only paid tickets can be checked in.");
    }
}
