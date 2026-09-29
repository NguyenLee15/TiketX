using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class DataProtectionRefundBankAccountProtector(IDataProtectionProvider provider) : IRefundBankAccountProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("TickeX.RefundBankAccount.v1");

    public string Protect(RefundBankAccountDetails details) =>
        _protector.Protect(JsonSerializer.Serialize(details));

    public RefundBankAccountDetails Unprotect(string protectedPayload) =>
        JsonSerializer.Deserialize<RefundBankAccountDetails>(_protector.Unprotect(protectedPayload))
        ?? throw new InvalidOperationException("Refund destination payload is invalid.");
}
