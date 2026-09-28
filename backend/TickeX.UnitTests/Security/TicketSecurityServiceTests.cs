using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TickeX.Infrastructure.Services;
using Xunit;
using FluentAssertions;

namespace TickeX.UnitTests.Security;

public class TicketSecurityServiceTests
{
    private readonly TicketSecurityService _service;

    public TicketSecurityServiceTests()
    {
        var inMemorySettings = new Dictionary<string, string?> {
            {"TicketSecurity:ActiveKeyId", "key-2026-v1"},
            {"TicketSecurity:SecretKeys:key-2026-v1", "TickeX_Super_Secret_Hmac_Signing_Key_For_Production_Events_2026_Must_Be_Long"}
        };

        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _service = new TicketSecurityService(configuration, NullLogger<TicketSecurityService>.Instance);
    }

    [Fact]
    public void ValidateQrToken_WhenPayloadIsMalformed_DoesNotExposeParserDetails()
    {
        var result = _service.ValidateQrToken("eyJ0aWQiOiJub3QtYS1ndWlkIn0.signature");

        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("QR");
        result.Message.Should().NotContain("Guid");
        result.Message.Should().NotContain("Format");
    }

    [Fact]
    public void GenerateSignedQrToken_ShouldProduceValidSignedToken()
    {
        // Arrange
        var ticketId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var orderCode = 889911L;
        var expiresAt = DateTime.UtcNow.AddDays(7);

        // Act
        string token = _service.GenerateSignedQrToken(ticketId, eventId, orderCode, expiresAt);

        // Assert
        token.Should().NotBeNullOrWhiteSpace();
        token.Should().Contain("."); // payload.signature format
    }

    [Fact]
    public void ValidateQrToken_WhenValid_ShouldReturnSuccessWithCorrectPayload()
    {
        // Arrange
        var ticketId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var orderCode = 123456L;
        var expiresAt = DateTime.UtcNow.AddHours(24);

        string token = _service.GenerateSignedQrToken(ticketId, eventId, orderCode, expiresAt);

        // Act
        var result = _service.ValidateQrToken(token);

        // Assert
        result.IsValid.Should().BeTrue();
        result.Payload.Should().NotBeNull();
        result.Payload!.TicketId.Should().Be(ticketId);
        result.Payload.EventId.Should().Be(eventId);
        result.Payload.OrderCode.Should().Be(orderCode);
    }

    [Fact]
    public void ValidateQrToken_WhenSignatureTampered_ShouldReturnInvalid()
    {
        // Arrange
        var ticketId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var orderCode = 999999L;
        var expiresAt = DateTime.UtcNow.AddHours(24);

        string token = _service.GenerateSignedQrToken(ticketId, eventId, orderCode, expiresAt);
        string tamperedToken = token.Substring(0, token.Length - 4) + "XXXX";

        // Act
        var result = _service.ValidateQrToken(tamperedToken);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("Chữ ký số vé không hợp lệ");
    }

    [Fact]
    public void ValidateQrToken_WhenExpired_ShouldReturnInvalidWithExpiredMessage()
    {
        // Arrange
        var ticketId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var orderCode = 111222L;
        var expiresAt = DateTime.UtcNow.AddSeconds(-10); // Expired in the past

        string token = _service.GenerateSignedQrToken(ticketId, eventId, orderCode, expiresAt);

        // Act
        var result = _service.ValidateQrToken(token);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("hết hạn");
    }

    [Fact]
    public void ValidateQrToken_WhenTokenStructureIsMalformed_ShouldReturnInvalid()
    {
        var result = _service.ValidateQrToken("not-a-valid-token");

        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("Định dạng mã QR không hợp lệ");
    }

    [Fact]
    public void ValidateQrToken_WhenKeyIdIsUnknown_ShouldReturnInvalid()
    {
        var payload = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(
            $"{{\"tid\":\"{Guid.NewGuid()}\",\"eid\":\"{Guid.NewGuid()}\",\"code\":123,\"exp\":{DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds()},\"kid\":\"unknown\"}}"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var result = _service.ValidateQrToken($"{payload}.signature");

        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("không tồn tại trong hệ thống");
    }
}
