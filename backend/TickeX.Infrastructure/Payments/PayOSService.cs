using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Payments;

public class PayOSService : IPayOSService
{
    private readonly HttpClient _httpClient;
    private readonly string _clientId;
    private readonly string _apiKey;
    private readonly string _checksumKey;
    private readonly ILogger<PayOSService> _logger;
    private readonly PayOSResilienceGate _resilience;

    public PayOSService(HttpClient httpClient, IConfiguration configuration)
        : this(httpClient, configuration, Microsoft.Extensions.Logging.Abstractions.NullLogger<PayOSService>.Instance, new PayOSResilienceGate())
    {
    }

    public PayOSService(HttpClient httpClient, IConfiguration configuration, ILogger<PayOSService> logger, PayOSResilienceGate? resilience = null)
    {
        _httpClient = httpClient;
        _clientId = configuration["PayOS:ClientId"] ?? throw new ArgumentNullException("PayOS:ClientId");
        _apiKey = configuration["PayOS:ApiKey"] ?? throw new ArgumentNullException("PayOS:ApiKey");
        _checksumKey = configuration["PayOS:ChecksumKey"] ?? throw new ArgumentNullException("PayOS:ChecksumKey");
        _logger = logger;
        _resilience = resilience ?? new PayOSResilienceGate();
        
        var baseUrl = configuration["PayOS:BaseUrl"]?.Trim() ?? "https://api-merchant.payos.vn/";
        if (!baseUrl.EndsWith('/')) baseUrl += "/";
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(15);
        _httpClient.DefaultRequestHeaders.Add("x-client-id", _clientId);
        _httpClient.DefaultRequestHeaders.Add("x-api-key", _apiKey);
    }

    public async Task<CreatePaymentResult?> CreatePaymentLink(long orderCode, int amount, string description, string returnUrl, string cancelUrl, CancellationToken cancellationToken = default)
    {
        if (!_resilience.TryEnter()) return null;
        var requestData = new
        {
            orderCode = orderCode,
            amount = amount,
            description = description,
            returnUrl = returnUrl,
            cancelUrl = cancelUrl
        };

        // Calculate Signature
        var signatureData = $"amount={amount}&cancelUrl={cancelUrl}&description={description}&orderCode={orderCode}&returnUrl={returnUrl}";
        string signature = HmacSha256(_checksumKey, signatureData);

        var payload = new
        {
            orderCode = orderCode,
            amount = amount,
            description = description,
            returnUrl = returnUrl,
            cancelUrl = cancelUrl,
            signature = signature
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsync("v2/payment-requests", content, cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _resilience.RecordFailure();
            throw;
        }
        catch (HttpRequestException)
        {
            _resilience.RecordFailure();
            throw;
        }

        if (response.IsSuccessStatusCode)
        {
            _resilience.RecordSuccess();
            var responseString = await response.Content.ReadAsStringAsync(cancellationToken);
            var jsonDoc = JsonDocument.Parse(responseString);
            var dataElement = jsonDoc.RootElement.GetProperty("data");
            string checkoutUrl = dataElement.GetProperty("checkoutUrl").GetString() ?? "";
            
            return new CreatePaymentResult { CheckoutUrl = checkoutUrl };
        }

        var error = await response.Content.ReadAsStringAsync(cancellationToken);
        _resilience.RecordFailure();
        _logger.LogWarning("PayOS payment-link request failed with HTTP status {StatusCode}.", (int)response.StatusCode);
        return null;
    }

    public async Task<PaymentLinkLookupResult?> GetPaymentLinkAsync(long orderCode, CancellationToken cancellationToken = default)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            if (!_resilience.TryEnter()) return new PaymentLinkLookupResult(PaymentLinkLookupState.Unknown);

            try
            {
                using var response = await _httpClient.GetAsync($"v2/payment-requests/{orderCode}", cancellationToken);
                if ((int)response.StatusCode == 404)
                {
                    _resilience.RecordSuccess();
                    return new PaymentLinkLookupResult(PaymentLinkLookupState.NotFound);
                }

                if (!response.IsSuccessStatusCode)
                {
                    if ((int)response.StatusCode >= 500 && attempt == 0)
                    {
                        await Task.Delay(PayOSResilienceGate.RetryDelay(attempt), cancellationToken);
                        continue;
                    }

                    _resilience.RecordFailure();
                    return new PaymentLinkLookupResult(PaymentLinkLookupState.Unknown);
                }

                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                if (!document.RootElement.TryGetProperty("data", out var data)
                    || !data.TryGetProperty("checkoutUrl", out var checkoutUrl))
                {
                    _resilience.RecordFailure();
                    return new PaymentLinkLookupResult(PaymentLinkLookupState.Unknown);
                }

                var value = checkoutUrl.GetString();
                if (string.IsNullOrWhiteSpace(value))
                {
                    _resilience.RecordFailure();
                    return new PaymentLinkLookupResult(PaymentLinkLookupState.Unknown);
                }

                _resilience.RecordSuccess();
                return new PaymentLinkLookupResult(PaymentLinkLookupState.Found, value);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested && attempt == 0)
            {
                await Task.Delay(PayOSResilienceGate.RetryDelay(attempt), cancellationToken);
            }
            catch (HttpRequestException) when (attempt == 0)
            {
                await Task.Delay(PayOSResilienceGate.RetryDelay(attempt), cancellationToken);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                _resilience.RecordFailure();
                return new PaymentLinkLookupResult(PaymentLinkLookupState.Unknown);
            }
            catch (HttpRequestException)
            {
                _resilience.RecordFailure();
                return new PaymentLinkLookupResult(PaymentLinkLookupState.Unknown);
            }
        }

        _resilience.RecordFailure();
        return new PaymentLinkLookupResult(PaymentLinkLookupState.Unknown);
    }

    public PayOSWebhookData? VerifyPaymentWebhookData(string webhookBody, string signature)
    {
        try
        {
            var jsonDoc = JsonDocument.Parse(webhookBody);
            
            // Extract signature from payload if not provided in header
            if (string.IsNullOrWhiteSpace(signature) && jsonDoc.RootElement.TryGetProperty("signature", out var sigProp))
            {
                signature = sigProp.GetString() ?? string.Empty;
            }

            if (!jsonDoc.RootElement.TryGetProperty("data", out var dataElement))
            {
                return null;
            }

            // Extract canonical data fields sorted by key name (PayOS spec)
            var sortedFields = new SortedDictionary<string, string>();
            foreach (var prop in dataElement.EnumerateObject())
            {
                var val = prop.Value.ValueKind switch
                {
                    JsonValueKind.Null => "",
                    JsonValueKind.Undefined => "",
                    _ => prop.Value.ToString()
                };
                sortedFields[prop.Name] = val;
            }

            var canonicalString = string.Join("&", sortedFields.Select(kv => $"{kv.Key}={kv.Value}"));
            string expectedSignature = HmacSha256(_checksumKey, canonicalString);

            // A webhook is an unauthenticated public endpoint. Never fail open when
            // the checksum key is missing or still contains a template value.
            if (string.IsNullOrWhiteSpace(_checksumKey) || _checksumKey == "YOUR_PAYOS_CHECKSUM_KEY")
                return null;
            if (string.IsNullOrWhiteSpace(signature))
                return null;

            var sigBytes = Encoding.UTF8.GetBytes(signature.ToLowerInvariant());
            var expectedBytes = Encoding.UTF8.GetBytes(expectedSignature.ToLowerInvariant());
            if (!CryptographicOperations.FixedTimeEquals(sigBytes, expectedBytes))
                return null;

            decimal amount = dataElement.GetProperty("amount").GetDecimal();
            long orderCode = dataElement.GetProperty("orderCode").GetInt64();
            string description = dataElement.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
            string reference = dataElement.TryGetProperty("reference", out var r) ? r.GetString() ?? "" : "";
            string transactionDateTime = dataElement.TryGetProperty("transactionDateTime", out var tdt) ? tdt.GetString() ?? "" : "";
            string currency = dataElement.TryGetProperty("currency", out var curr) ? curr.GetString() ?? "VND" : "VND";
            if (!string.Equals(currency, "VND", StringComparison.OrdinalIgnoreCase))
                return null;
            string paymentLinkId = dataElement.TryGetProperty("paymentLinkId", out var plid) ? plid.GetString() ?? "" : "";
            string code = jsonDoc.RootElement.TryGetProperty("code", out var c) ? c.GetString() ?? "" : "";

            bool success = code == "00";

            return new PayOSWebhookData
            {
                OrderCode = orderCode,
                Amount = amount,
                Description = description,
                Reference = reference,
                TransactionDateTime = transactionDateTime,
                Currency = currency,
                PaymentLinkId = paymentLinkId,
                Code = code,
                Success = success,
                PayloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(webhookBody))).ToLowerInvariant()
            };
        }
        catch
        {
            return null;
        }
    }

    private string HmacSha256(string key, string inputData)
    {
        var hash = new StringBuilder();
        byte[] keyBytes = Encoding.UTF8.GetBytes(key);
        byte[] inputBytes = Encoding.UTF8.GetBytes(inputData);
        using (var hmac = new HMACSHA256(keyBytes))
        {
            byte[] hashValue = hmac.ComputeHash(inputBytes);
            foreach (var theByte in hashValue)
            {
                hash.Append(theByte.ToString("x2"));
            }
        }
        return hash.ToString();
    }
}
