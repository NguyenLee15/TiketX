namespace TickeX.Application.Interfaces;

public sealed record RefundBankAccountDetails(string BankBin, string AccountName, string AccountNumber);

public interface IRefundBankAccountProtector
{
    string Protect(RefundBankAccountDetails details);
    RefundBankAccountDetails Unprotect(string protectedPayload);
}
