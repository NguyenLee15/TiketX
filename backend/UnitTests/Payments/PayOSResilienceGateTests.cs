using FluentAssertions;
using TickeX.Infrastructure.Payments;
using Xunit;

namespace TickeX.UnitTests.Payments;

public sealed class PayOSResilienceGateTests
{
    [Fact]
    public void Gate_OpensAfterFiveProviderFailures()
    {
        var gate = new PayOSResilienceGate();

        gate.TryEnter().Should().BeTrue();
        for (var i = 0; i < 5; i++) gate.RecordFailure();

        gate.TryEnter().Should().BeFalse();
    }

    [Fact]
    public void GateSuccess_ResetsFailureWindow()
    {
        var gate = new PayOSResilienceGate();
        for (var i = 0; i < 4; i++) gate.RecordFailure();

        gate.RecordSuccess();
        gate.TryEnter().Should().BeTrue();
    }
}
