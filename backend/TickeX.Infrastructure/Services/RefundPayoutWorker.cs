using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;

namespace TickeX.Infrastructure.Services;

public sealed class RefundPayoutWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<RefundPayoutWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan ClaimDuration = TimeSpan.FromMinutes(2);
    private readonly string _workerId = $"refund-worker-{Guid.NewGuid():N}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!await ProcessOneAsync(stoppingToken)) await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Refund payout worker iteration failed.");
                await Task.Delay(PollInterval, stoppingToken);
            }
        }
    }

    private async Task<bool> ProcessOneAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTime.UtcNow;
        var candidateId = await db.RefundRequests.AsNoTracking()
            .Where(x => x.EncryptedDestinationSnapshot != null && x.Status != "Completed" && x.Status != "NeedsReview"
                && (x.NextAttemptAt == null || x.NextAttemptAt <= now)
                && (x.LeaseUntil == null || x.LeaseUntil <= now))
            .OrderBy(x => x.NextAttemptAt ?? x.CreatedAt)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (candidateId is null) return false;

        var leaseUntil = now.Add(ClaimDuration);
        var claimed = await db.RefundRequests.Where(x => x.Id == candidateId.Value
                && x.EncryptedDestinationSnapshot != null && x.Status != "Completed" && x.Status != "NeedsReview"
                && (x.NextAttemptAt == null || x.NextAttemptAt <= now)
                && (x.LeaseUntil == null || x.LeaseUntil <= now))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, "Processing")
                .SetProperty(x => x.LeaseOwner, _workerId)
                .SetProperty(x => x.LeaseUntil, leaseUntil)
                .SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1), cancellationToken);
        if (claimed != 1) return true;

        var refund = await db.RefundRequests.SingleAsync(x => x.Id == candidateId.Value && x.LeaseOwner == _workerId, cancellationToken);
        var ticket = await db.Tickets.SingleAsync(x => x.Id == refund.TicketId, cancellationToken);
        var payment = await db.PaymentTransactions.SingleOrDefaultAsync(x => x.TicketId == refund.TicketId, cancellationToken);
        var provider = scope.ServiceProvider.GetRequiredService<IPayOSPayoutService>();
        var protector = scope.ServiceProvider.GetRequiredService<IRefundBankAccountProtector>();
        var destination = protector.Unprotect(refund.EncryptedDestinationSnapshot!);
        var stableReference = $"refund-{refund.Id:N}-{refund.ProviderRetryGeneration}";
        var providerIdempotencyKey = $"{refund.Id:N}-{refund.ProviderRetryGeneration}";

        if (refund.Amount != decimal.Truncate(refund.Amount))
        {
            refund.MarkNeedsReview("Refund amount is not an integer VND amount.", "INVALID_AMOUNT");
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }

        try
        {
            PayOSPayoutResult result;
            if ((refund.ProviderStatus is "PROCESSING" or "PENDING") && refund.ProviderReference is not null)
            {
                result = await provider.GetStatusAsync(refund.ProviderReference, cancellationToken);
            }
            else if (refund.ProviderStatus == "SUBMITTING" || refund.ProviderStatus == "UNKNOWN")
            {
                result = await provider.FindByReferenceAsync(stableReference, cancellationToken);
                if (result.State == "NOT_FOUND")
                    result = await provider.CreateOrGetAsync(stableReference, providerIdempotencyKey, checked((long)refund.Amount), destination, cancellationToken);
            }
            else
            {
                refund.SetProviderReference(stableReference, "SUBMITTING");
                await db.SaveChangesAsync(cancellationToken);
                result = await provider.CreateOrGetAsync(stableReference, providerIdempotencyKey, checked((long)refund.Amount), destination, cancellationToken);
            }

            if (result.State == "SUCCEEDED" && !result.MatchesDestination(destination))
            {
                refund.MarkNeedsReview("PayOS reported success for a destination that does not match the saved refund account.", "SUCCEEDED_DESTINATION_MISMATCH");
            }
            else if (result.State == "SUCCEEDED")
            {
                refund.MarkCompleted(result.PayoutId ?? refund.ProviderReference ?? stableReference);
                ticket.CompleteRefund(refund.Amount);
                payment?.MarkRefunded(result.PayoutId ?? stableReference, "PayOS payout confirmed SUCCEEDED");
            }
            else if (result.State is "PROCESSING" or "PENDING" or "NOT_FOUND")
            {
                refund.SetProviderReference(result.PayoutId ?? refund.ProviderReference ?? stableReference, result.State == "NOT_FOUND" ? "SUBMITTING" : result.State);
                refund.ScheduleRetry("PayOS payout is not complete yet.", DateTime.UtcNow.AddSeconds(20), result.State == "NOT_FOUND" ? "SUBMITTING" : result.State);
            }
            else if (result.Error is not null && refund.AttemptCount < 8)
            {
                var jitter = Random.Shared.Next(5, 26);
                refund.SetProviderReference(refund.ProviderReference ?? stableReference, "UNKNOWN");
                refund.ScheduleRetry(result.Error, DateTime.UtcNow.AddSeconds(Math.Min(900, (int)Math.Pow(2, refund.AttemptCount) * jitter)), "UNKNOWN");
            }
            else
            {
                refund.MarkNeedsReview(result.Error ?? $"PayOS payout ended in state {result.State}.", result.State);
                payment?.MarkRefundFailed(result.Error ?? $"Payout state: {result.State}");
            }
            if (!await ExtendLeaseIfOwnedAsync(db, refund.Id, cancellationToken)) return true;
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Refund payout attempt failed for refund {RefundId}.", refund.Id);
            if (refund.AttemptCount >= 8) refund.MarkNeedsReview("Provider state is uncertain after repeated attempts.", "UNKNOWN");
            else
            {
                var delaySeconds = Math.Min(900, (int)Math.Pow(2, refund.AttemptCount) * Random.Shared.Next(5, 26));
                refund.SetProviderReference(refund.ProviderReference ?? stableReference, "UNKNOWN");
                refund.ScheduleRetry("Provider state is uncertain; retry will reuse the same idempotency key.", DateTime.UtcNow.AddSeconds(delaySeconds), "UNKNOWN");
            }
            if (!await ExtendLeaseIfOwnedAsync(db, refund.Id, cancellationToken)) return true;
            await db.SaveChangesAsync(cancellationToken);
        }
        return true;
    }

    private async Task<bool> ExtendLeaseIfOwnedAsync(ApplicationDbContext db, Guid refundId, CancellationToken cancellationToken)
    {
        var nextLeaseUntil = DateTime.UtcNow.Add(ClaimDuration);
        var updated = await db.RefundRequests.Where(x => x.Id == refundId && x.LeaseOwner == _workerId && x.LeaseUntil > DateTime.UtcNow)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.LeaseUntil, nextLeaseUntil), cancellationToken);
        return updated == 1;
    }
}
