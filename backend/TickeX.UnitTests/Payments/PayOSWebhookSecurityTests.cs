using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using TickeX.Infrastructure.Payments;

namespace TickeX.UnitTests.Payments;

public sealed class PayOSWebhookSecurityTests
{
    [Fact]
    public void VerifyWebhook_WhenChecksumIsMissing_ShouldRejectEvenIfPayloadIsValid()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayOS:ClientId"] = "client",
                ["PayOS:ApiKey"] = "api",
                ["PayOS:ChecksumKey"] = ""
            })
            .Build();
        var service = new PayOSService(new HttpClient(), configuration);

        var result = service.VerifyPaymentWebhookData(
            "{\"code\":\"00\",\"data\":{\"amount\":100000,\"orderCode\":12345}}",
            "");

        result.Should().BeNull();
    }

    [Fact]
    public void VerifyWebhook_DoesNotRetainRawBody_AndReturnsPayloadHash()
    {
        const string checksumKey = "test-checksum";
        const string body = "{\"code\":\"00\",\"data\":{\"amount\":100000,\"orderCode\":12345,\"accountNumber\":\"123456789\"}}";
        var signature = Convert.ToHexString(HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(checksumKey),
            Encoding.UTF8.GetBytes("accountNumber=123456789&amount=100000&orderCode=12345"))).ToLowerInvariant();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayOS:ClientId"] = "client",
                ["PayOS:ApiKey"] = "api",
                ["PayOS:ChecksumKey"] = checksumKey
            })
            .Build();

        var result = new PayOSService(new HttpClient(), configuration)
            .VerifyPaymentWebhookData(body, signature);

        result.Should().NotBeNull();
        result!.PayloadHash.Should().Be(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(body))).ToLowerInvariant());
    }
}
