using Microsoft.Extensions.Configuration;
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
}
