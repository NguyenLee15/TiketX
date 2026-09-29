using FluentAssertions;
using TickeX.Application.Tickets;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class CustomerRefundPolicyTests
{
    [Fact]
    public void UsesTwentyFourHourDefaultWhenConfiguredCutoffIsNotPositive()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        CustomerRefundPolicy.GetAllowedUntil(eventStart, 0)
            .Should().Be(new DateTime(2026, 10, 9, 12, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void AllowsRefundAtTheExactCutoffBoundary()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        var cutoff = CustomerRefundPolicy.GetAllowedUntil(eventStart, 24);

        CustomerRefundPolicy.CanRefund(cutoff, eventStart, 24).Should().BeTrue();
    }

    [Fact]
    public void RejectsRefundAfterTheCutoffBoundary()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        CustomerRefundPolicy.CanRefund(eventStart.AddHours(-23.999), eventStart, 24).Should().BeFalse();
    }
}
