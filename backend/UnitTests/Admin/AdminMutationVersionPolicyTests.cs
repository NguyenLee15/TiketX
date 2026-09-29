using FluentAssertions;
using TickeX.Application.Admin;
using Xunit;

namespace TickeX.UnitTests.Admin;

public class AdminMutationVersionPolicyTests
{
    [Fact]
    public void TryDecodeRequiredVersion_RejectsMissingVersion()
    {
        AdminMutationVersionPolicy.TryDecodeRequiredVersion(null, out _).Should().BeFalse();
    }

    [Fact]
    public void TryDecodeRequiredVersion_RejectsMalformedVersion()
    {
        AdminMutationVersionPolicy.TryDecodeRequiredVersion("not-base64", out _).Should().BeFalse();
    }

    [Fact]
    public void TryDecodeRequiredVersion_AcceptsNonEmptyBase64Version()
    {
        var encoded = Convert.ToBase64String(new byte[] { 1, 2, 3 });

        AdminMutationVersionPolicy.TryDecodeRequiredVersion(encoded, out var version).Should().BeTrue();
        version.Should().Equal(1, 2, 3);
    }
}
