using FluentAssertions;
using TickeX.Application.Auth;
using TickeX.Domain.Entities;

namespace TickeX.UnitTests.Security;

public sealed class RefreshTokenTests
{
    [Fact]
    public void GeneratedToken_IsHashedBeforePersistence()
    {
        var raw = RefreshTokenCrypto.Generate();
        raw.Should().NotBe(RefreshTokenCrypto.Hash(raw));
        RefreshTokenCrypto.Hash(raw).Should().HaveLength(64);
    }

    [Fact]
    public void Revoke_MakesTokenInactiveAndRecordsReplacement()
    {
        var token = new RefreshToken(Guid.NewGuid(), "hash", DateTime.UtcNow.AddDays(1));
        token.IsActive(DateTime.UtcNow).Should().BeTrue();
        token.Revoke("replacement");
        token.IsActive(DateTime.UtcNow).Should().BeFalse();
        token.ReplacedByTokenHash.Should().Be("replacement");
    }
}
