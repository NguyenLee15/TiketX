using System;
using Microsoft.Extensions.Configuration;
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

        _service = new TicketSecurityService(configuration);
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

    [Theory]
    [InlineData("not-a-valid-token")]
    [InlineData("invalid_payload.invalid_signature")]
    [InlineData("YWJj.def")]
    [InlineData("eyJhIjoxfQ.invalid_sig_bytes")]
    public void ValidateQrToken_WhenPayloadIsMalformed_ShouldReturnGenericSafeErrorMessageWithoutExceptionLeak(string malformedToken)
    {
        // Act
        var result = _service.ValidateQrToken(malformedToken);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Message.Should().Match(m => m.Contains("không hợp lệ"));
        result.Message.Should().NotContain("Exception");
        result.Message.Should().NotContain("Lỗi phân tích");
        result.Message.Should().NotContain("payload.signature");
    }

    [Fact]
    public void ValidateQrToken_WhenKeyIdNotFound_ShouldReturnSafeKeyMessage()
    {
        // Arrange: Generate payload with unknown kid
        var payloadObj = new
        {
            tid = Guid.NewGuid(),
            eid = Guid.NewGuid(),
            code = 123456L,
            exp = DateTimeOffset.UtcNow.AddHours(5).ToUnixTimeSeconds(),
            kid = "non-existent-kid-999"
        };
        var json = System.Text.Json.JsonSerializer.Serialize(payloadObj);
        var base64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var dummyToken = $"{base64}.dummySignature";

        // Act
        var result = _service.ValidateQrToken(dummyToken);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Message.Should().Be("Mã định danh khóa ký không tồn tại hoặc đã hết hiệu lực.");
    }
}
