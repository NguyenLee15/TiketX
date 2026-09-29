namespace TickeX.Domain.Entities;

public sealed class RefundBankAccount : BaseEntity
{
    public Guid UserId { get; private set; }
    public string EncryptedPayload { get; private set; } = string.Empty;
    public string AccountLastFour { get; private set; } = string.Empty;

    private RefundBankAccount() { }

    public RefundBankAccount(Guid userId, string encryptedPayload, string accountLastFour)
    {
        UserId = userId;
        Replace(encryptedPayload, accountLastFour);
    }

    public void Replace(string encryptedPayload, string accountLastFour)
    {
        EncryptedPayload = encryptedPayload;
        AccountLastFour = accountLastFour;
        UpdatedAt = DateTime.UtcNow;
    }
}
