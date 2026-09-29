namespace TickeX.Domain.Entities;

public class AuditLog : BaseEntity
{
    public Guid? UserId { get; private set; }
    public string UserEmail { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string EntityName { get; private set; } = string.Empty;
    public string? EntityId { get; private set; }
    public string? BeforeState { get; private set; }
    public string? AfterState { get; private set; }
    public DateTime TimestampUtc { get; private set; } = DateTime.UtcNow;
    public string? IpAddress { get; private set; }

    private AuditLog() { } // For EF Core

    public AuditLog(
        Guid? userId,
        string userEmail,
        string action,
        string entityName,
        string? entityId,
        string? beforeState = null,
        string? afterState = null,
        string? ipAddress = null)
    {
        UserId = userId;
        UserEmail = userEmail;
        Action = action;
        EntityName = entityName;
        EntityId = entityId;
        BeforeState = beforeState;
        AfterState = afterState;
        TimestampUtc = DateTime.UtcNow;
        IpAddress = ipAddress;
    }
}

