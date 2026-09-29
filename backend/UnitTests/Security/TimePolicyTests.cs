using FluentAssertions;
using TickeX.Application.Interfaces;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Security;

public sealed class TimePolicyTests
{
    [Fact]
    public void LocalDateStart_UsesVietnamBusinessDate()
    {
        ITimePolicy policy = new VietnamTimePolicy();
        var utc = new DateTime(2026, 1, 1, 17, 30, 0, DateTimeKind.Utc);

        policy.LocalDateStart(utc).Should().Be(new DateTime(2026, 1, 1, 17, 0, 0, DateTimeKind.Utc));
    }
}
