using System.Security.Cryptography;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Payments;

public sealed class PayOSPayoutService : IPayOSPayoutService
{
    private readonly HttpClient _client;
    private readonly string _clientId;
    private readonly string _apiKey;
    private readonly string _checksumKey;

    public PayOSPayoutService(HttpClient client, IConfiguration configuration)
    {
        _client = client;
        _clientId = configuration["PayOS:PayoutClientId"] ?? throw new InvalidOperationException("PayOS:PayoutClientId is required for payouts.");
        _apiKey = configuration["PayOS:PayoutApiKey"] ?? throw new InvalidOperationException("PayOS:PayoutApiKey is required for payouts.");
        _checksumKey = configuration["PayOS:PayoutChecksumKey"] ?? throw new InvalidOperationException("PayOS:PayoutChecksumKey is required for payouts.");
        var baseUrl = configuration["PayOS:BaseUrl"]?.Trim() ?? "https://api-merchant.payos.vn/";
        _client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
        _client.Timeout = TimeSpan.FromSeconds(15);
    }

    public async Task<PayOSPayoutResult> CreateOrGetAsync(string referenceId, string idempotencyKey, long amount, RefundBankAccountDetails destination, CancellationToken cancellationToken)
    {
        var payload = new
        {
            referenceId,
            category = new[] { "refund" },
            validateDestination = true,
            payouts = new[] { new { referenceId, amount, description = $"TickeX refund {referenceId}", toBin = destination.BankBin, toAccountNumber = destination.AccountNumber } }
        };
        var canonical = string.Join("&", new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["category"] = JsonSerializer.Serialize(payload.category),
            ["payouts"] = JsonSerializer.Serialize(payload.payouts),
            ["referenceId"] = referenceId,
            ["validateDestination"] = "true"
        }.Select(x => $"{Uri.EscapeDataString(x.Key)}={Uri.EscapeDataString(x.Value)}"));
        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/payouts/batch") { Content = JsonContent.Create(payload) };
        AddHeaders(request, idempotencyKey, Sign(canonical));
        using var response = await _client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return await FindByReferenceAsync(referenceId, cancellationToken);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return Parse(document.RootElement);
    }

    public async Task<PayOSPayoutResult> GetStatusAsync(string payoutId, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"v1/payouts/{Uri.EscapeDataString(payoutId)}");
        AddHeaders(request, null, null);
        using var response = await _client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return new PayOSPayoutResult(payoutId, null, $"PayOS status returned HTTP {(int)response.StatusCode}.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return Parse(document.RootElement);
    }

    public async Task<PayOSPayoutResult> FindByReferenceAsync(string referenceId, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"v1/payouts?referenceId={Uri.EscapeDataString(referenceId)}&limit=10&offset=0");
        AddHeaders(request, null, null);
        using var response = await _client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return new PayOSPayoutResult(null, null, $"PayOS reference lookup returned HTTP {(int)response.StatusCode}.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var root = document.RootElement;
        var data = root.TryGetProperty("data", out var d) ? d : default;
        var payouts = data.ValueKind == JsonValueKind.Object && data.TryGetProperty("payouts", out var p) ? p : default;
        if (payouts.ValueKind != JsonValueKind.Array || payouts.GetArrayLength() == 0) return new PayOSPayoutResult(null, "NOT_FOUND", null);
        return Parse(root, payouts[0]);
    }

    private void AddHeaders(HttpRequestMessage request, string? idempotencyKey, string? signature)
    {
        request.Headers.TryAddWithoutValidation("x-client-id", _clientId);
        request.Headers.TryAddWithoutValidation("x-api-key", _apiKey);
        if (idempotencyKey is not null) request.Headers.TryAddWithoutValidation("x-idempotency-key", idempotencyKey);
        if (signature is not null) request.Headers.TryAddWithoutValidation("x-signature", signature);
    }

    private string Sign(string data) => Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(_checksumKey), Encoding.UTF8.GetBytes(data))).ToLowerInvariant();

    private static PayOSPayoutResult Parse(JsonElement root) =>
        Parse(root, root.TryGetProperty("data", out var data) ? data : default);

    private static PayOSPayoutResult Parse(JsonElement root, JsonElement data)
    {
        if (data.ValueKind == JsonValueKind.Undefined || data.ValueKind == JsonValueKind.Null)
            return new PayOSPayoutResult(null, null, root.TryGetProperty("desc", out var desc) ? desc.GetString() : "PayOS response has no data.");
        var id = data.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
        var state = data.TryGetProperty("approvalState", out var approval) ? approval.GetString() : null;
        string? bankBin = null;
        string? accountNumber = null;
        string? accountName = null;
        if (data.TryGetProperty("transactions", out var transactions))
        {
            var first = transactions.ValueKind == JsonValueKind.Array ? transactions.EnumerateArray().FirstOrDefault()
                : transactions.ValueKind == JsonValueKind.Object && transactions.EnumerateObject().Any() ? transactions.EnumerateObject().First().Value : default;
            if (first.ValueKind == JsonValueKind.Object)
            {
                if (first.TryGetProperty("state", out var transactionState)) state = transactionState.GetString();
                bankBin = first.TryGetProperty("toBin", out var bin) ? bin.GetString() : null;
                accountNumber = first.TryGetProperty("toAccountNumber", out var number) ? number.GetString() : null;
                accountName = first.TryGetProperty("toAccountName", out var name) ? name.GetString() : null;
            }
        }
        return new PayOSPayoutResult(id, state, null, bankBin, accountNumber, accountName);
    }
}
