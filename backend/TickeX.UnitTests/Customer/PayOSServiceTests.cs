using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using TickeX.Infrastructure.Payments;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class PayOSServiceTests
{
    [Fact]
    public async Task CreatePaymentLink_SendsServerHoldExpiry()
    {
        string? body = null;
        var service = CreateService(async request =>
        {
            body = await request.Content!.ReadAsStringAsync();
            return Reply("{\"code\":\"00\",\"data\":{\"checkoutUrl\":\"https://pay.example/link\"}}");
        });
        var expiresAt = new DateTimeOffset(2026, 9, 26, 12, 5, 0, TimeSpan.Zero);

        var result = await service.CreatePaymentLink(123, 100000, "ticket", "https://example/return", "https://example/cancel", expiresAt: expiresAt);

        result!.CheckoutUrl.Should().Be("https://pay.example/link");
        using var json = JsonDocument.Parse(body!);
        json.RootElement.GetProperty("expiredAt").GetInt64().Should().Be(expiresAt.ToUnixTimeSeconds());
    }

    [Fact]
    public async Task CancelPaymentLink_ExposesProviderStateRatherThanHttpSuccess()
    {
        var service = CreateService(_ => Task.FromResult(Reply("{\"code\":\"00\",\"data\":{\"status\":\"PROCESSING\"}}")));

        var result = await service.CancelPaymentLinkAsync(123, "reservation_expired");

        result!.Status.Should().Be("PROCESSING");
    }

    private static PayOSService CreateService(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond)
    {
        var client = new HttpClient(new StubHandler(respond));
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["PayOS:ClientId"] = "test-client",
            ["PayOS:ApiKey"] = "test-key",
            ["PayOS:ChecksumKey"] = "test-checksum"
        }).Build();
        return new PayOSService(client, config);
    }

    private static HttpResponseMessage Reply(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => respond(request);
    }
}
