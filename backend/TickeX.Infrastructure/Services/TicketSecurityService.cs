using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public class TicketSecurityService : ITicketSecurityService
{
    private readonly Dictionary<string, string> _keyRotationMap = new();
    private readonly string _activeKeyId;

    public TicketSecurityService(IConfiguration configuration)
    {
        // Load active key id and key store
        _activeKeyId = configuration["TicketSecurity:ActiveKeyId"] ?? "k1";
        
        var primarySecret = configuration[$"TicketSecurity:SecretKeys:{_activeKeyId}"]
            ?? configuration["TicketSecurity:Secret"]
            ?? throw new InvalidOperationException($"TicketSecurity secret for active key '{_activeKeyId}' is not configured.");
        _keyRotationMap[_activeKeyId] = primarySecret;
        if (!_keyRotationMap.ContainsKey("k1"))
        {
            _keyRotationMap["k1"] = primarySecret;
        }

        // Load rotation keys if configured
        var secondarySecret = configuration["TicketSecurity:Secret_k2"];
        if (!string.IsNullOrEmpty(secondarySecret))
        {
            _keyRotationMap["k2"] = secondarySecret;
        }
    }

    public string GenerateSignedQrToken(Guid ticketId, Guid eventId, long orderCode, DateTime expiresAt, string keyId = "k1")
    {
        var targetKid = (string.IsNullOrEmpty(keyId) || keyId == "k1") ? _activeKeyId : keyId;
        if (!_keyRotationMap.TryGetValue(targetKid, out var secret))
        {
            secret = _keyRotationMap[_activeKeyId];
            targetKid = _activeKeyId;
        }

        var payloadObj = new
        {
            tid = ticketId,
            eid = eventId,
            code = orderCode,
            exp = new DateTimeOffset(expiresAt).ToUnixTimeSeconds(),
            kid = targetKid
        };

        string payloadJson = JsonSerializer.Serialize(payloadObj);
        string payloadBase64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadBase64));
        string signature = Base64UrlEncode(hash);

        return $"{payloadBase64}.{signature}";
    }

    public QrValidationResult ValidateQrToken(string qrToken)
    {
        if (string.IsNullOrWhiteSpace(qrToken))
        {
            return new QrValidationResult(false, "Token QR không được để trống.");
        }

        var parts = qrToken.Split('.');
        if (parts.Length != 2)
        {
            return new QrValidationResult(false, "Định dạng mã QR không hợp lệ (sai cấu trúc payload.signature).");
        }

        string payloadBase64 = parts[0];
        string signature = parts[1];

        try
        {
            byte[] payloadBytes = Base64UrlDecode(payloadBase64);
            string payloadJson = Encoding.UTF8.GetString(payloadBytes);
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;

            var ticketId = root.GetProperty("tid").GetGuid();
            var eventId = root.GetProperty("eid").GetGuid();
            var orderCode = root.GetProperty("code").GetInt64();
            var expUnix = root.GetProperty("exp").GetInt64();
            var kid = root.TryGetProperty("kid", out var kidProp) ? kidProp.GetString() ?? "k1" : "k1";

            if (!_keyRotationMap.TryGetValue(kid, out var secret))
            {
                return new QrValidationResult(false, $"Mã định danh khóa ký (kid: {kid}) không tồn tại trong hệ thống.");
            }

            // Verify signature
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            byte[] expectedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadBase64));
            string expectedSignature = Base64UrlEncode(expectedHash);

            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(signature), Encoding.UTF8.GetBytes(expectedSignature)))
            {
                return new QrValidationResult(false, "Chữ ký số vé không hợp lệ! Nghi vấn vé giả mạo.");
            }

            var expiresAt = DateTimeOffset.FromUnixTimeSeconds(expUnix).UtcDateTime;
            if (DateTime.UtcNow > expiresAt)
            {
                return new QrValidationResult(false, $"Vé đã hết hạn sử dụng (Hạn cuối: {expiresAt:dd/MM/yyyy HH:mm}).");
            }

            var payload = new TicketQrPayload(ticketId, eventId, orderCode, expiresAt, kid);
            return new QrValidationResult(true, "Mã QR vé hợp lệ.", payload);
        }
        catch (Exception ex)
        {
            return new QrValidationResult(false, $"Lỗi phân tích mã QR: {ex.Message}");
        }
    }

    private static string Base64UrlEncode(byte[] input)
    {
        return Convert.ToBase64String(input)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        string base64 = input
            .Replace("-", "+")
            .Replace("_", "/");

        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }

        return Convert.FromBase64String(base64);
    }
}
