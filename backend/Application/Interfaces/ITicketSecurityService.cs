namespace TickeX.Application.Interfaces;

public record TicketQrPayload(Guid TicketId, Guid EventId, long OrderCode, DateTime ExpiresAt, string KeyId = "k1");

public record QrValidationResult(bool IsValid, string Message, TicketQrPayload? Payload = null);

public interface ITicketSecurityService
{
    string GenerateSignedQrToken(Guid ticketId, Guid eventId, long orderCode, DateTime expiresAt, string keyId = "k1");
    QrValidationResult ValidateQrToken(string qrToken);
}
