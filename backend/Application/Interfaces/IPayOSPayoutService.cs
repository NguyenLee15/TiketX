namespace TickeX.Application.Interfaces;

public sealed record PayOSPayoutResult(
    string? PayoutId,
    string? State,
    string? Error,
    string? DestinationBankBin = null,
    string? DestinationAccountNumber = null,
    string? DestinationAccountName = null)
{
    public bool MatchesDestination(RefundBankAccountDetails expected) =>
        string.Equals(DestinationBankBin, expected.BankBin, StringComparison.Ordinal)
        && string.Equals(DestinationAccountNumber, expected.AccountNumber, StringComparison.Ordinal)
        && Normalize(DestinationAccountName) == Normalize(expected.AccountName);

    private static string Normalize(string? value) =>
        string.Join(' ', (value ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
}

public interface IPayOSPayoutService
{
    Task<PayOSPayoutResult> CreateOrGetAsync(string referenceId, string idempotencyKey, long amount, RefundBankAccountDetails destination, CancellationToken cancellationToken);
    Task<PayOSPayoutResult> GetStatusAsync(string payoutId, CancellationToken cancellationToken);
    Task<PayOSPayoutResult> FindByReferenceAsync(string referenceId, CancellationToken cancellationToken);
}
