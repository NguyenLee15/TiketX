using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments;
using TickeX.Application.Seats;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Payments.Commands;

public partial class ProcessPaymentCommandHandler
{
    public async Task<bool> Handle(ProcessPaymentCommand request, CancellationToken cancellationToken)
    {
        var data = request.PaymentData;
        var initialTicket = await _context.Tickets
            .FirstOrDefaultAsync(t => t.OrderCode == data.OrderCode, cancellationToken);

        if (initialTicket == null)
        {
            _logger.LogWarning("Payment webhook received for non-existent order {OrderCode}", data.OrderCode);
            return false;
        }

        IDistributedLockLease? eventLease;
        try
        {
            eventLease = await _lockService.AcquireLockAsync(
                $"event:cancel:{initialTicket.EventId:N}", TimeSpan.FromSeconds(30), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Required event lock is unavailable for payment order {OrderCode}; leaving webhook unprocessed for retry.", data.OrderCode);
            return false;
        }

        if (eventLease is null || !eventLease.IsValid)
        {
            _logger.LogWarning("Could not acquire event lock for payment order {OrderCode}; leaving webhook unprocessed for retry.", data.OrderCode);
            return false;
        }

        string lockKey = $"payment:lock:{initialTicket.OrderCode}";
        IDistributedLockLease? lease;
        try
        {
            lease = await _lockService.AcquireLockAsync(lockKey, TimeSpan.FromSeconds(30), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Required payment lock is unavailable for {OrderCode}; leaving webhook unprocessed for retry.", data.OrderCode);
            return false;
        }

        if (lease is null)
        {
            _logger.LogWarning("Could not acquire payment lock for {OrderCode}; leaving webhook unprocessed for retry.", data.OrderCode);
            return false;
        }

        await using (eventLease)
        await using (lease)
        {
            // Re-fetch the ticket inside the lock with Event and Seat included
            var ticket = await _context.Tickets
                .Include(t => t.Seat)
                .Include(t => t.Event)
                .FirstOrDefaultAsync(t => t.Id == initialTicket.Id, cancellationToken);

            if (ticket == null)
            {
                return false;
            }

            // 1. Check existing PaymentTransaction for idempotency
            var existingTx = await _context.PaymentTransactions
                .FirstOrDefaultAsync(pt => pt.OrderCode == data.OrderCode, cancellationToken);

            // Invariant 1: If ticket is ALREADY Paid, never downgrade or cancel!
            if (ticket.Status == TicketStatus.Paid)
            {
                if (data.Success)
                {
                    _logger.LogInformation("Idempotent webhook: Ticket {TicketId} for order {OrderCode} is already marked as Paid.", ticket.Id, data.OrderCode);
                    return true;
                }
                else
                {
                    _logger.LogWarning("Security invariant preserved: Webhook requested cancellation for already Paid ticket {TicketId}, order {OrderCode}. Ignoring failure transition.", ticket.Id, data.OrderCode);
                    return true; // Acknowledge webhook without downgrading status
                }
            }

            var providerTxId = PaymentWebhookPolicy.ProviderTransactionId(data);
            var auditSummary = PaymentWebhookPolicy.AuditSummary(data, providerTxId);

            // Invariant 2: Ticket must be Pending AND within the reservation hold window to process payment
            var isHoldExpired = ticket.Status == TicketStatus.Pending && (_time.UtcNow - ticket.CreatedAt > _holdDuration);

            if (ticket.Status != TicketStatus.Pending || isHoldExpired)
            {
                if (data.Success)
                {
                    if (isHoldExpired)
                    {
                        ticket.Cancel();
                        if (ticket.Seat != null)
                        {
                            ticket.Seat.Release();
                        }
                    }

                    var reason = isHoldExpired
                        ? $"Reservation hold expired ({_holdDuration.TotalMinutes:0}m limit exceeded)"
                        : $"Hold expired or invalid status: {ticket.Status}";

                    _logger.LogError("ORPHANED PAYMENT DETECTED: Order {OrderCode}, Ticket {TicketId}, Amount {Amount}. Ticket status is {Status}, HoldExpired: {IsHoldExpired}. Money captured but reservation hold expired or invalid. Recording OrphanedPaid transaction for compensation.",
                        data.OrderCode, ticket.Id, data.Amount, ticket.Status, isHoldExpired);

                    if (existingTx == null)
                    {
                        var transaction = new PaymentTransaction(
                            ticket.OrderCode,
                            ticket.Id,
                            data.Amount,
                            "VietQR_PayOS"
                        );
                        transaction.MarkOrphaned(reason, providerTxId, auditSummary);
                        transaction.SetWebhookPayloadHash(data.PayloadHash);
                        _context.PaymentTransactions.Add(transaction);
                    }
                    else
                    {
                        existingTx.MarkOrphaned(reason, providerTxId, auditSummary);
                        existingTx.SetWebhookPayloadHash(data.PayloadHash);
                    }

                    var audit = new AuditLog(
                        ticket.UserId,
                        "system@tickex.internal",
                        "ORPHANED_PAYMENT_DETECTED",
                        "PaymentTransaction",
                        data.OrderCode.ToString(),
                        $"TicketStatus: {ticket.Status}; HoldExpired: {isHoldExpired}",
                        $"ProviderTxId: {providerTxId}; ActionRequired: RefundCompensation"
                    );
                    _context.AuditLogs.Add(audit);

                    var hasRefundRequest = await _context.RefundRequests
                        .AnyAsync(r => r.TicketId == ticket.Id, cancellationToken);
                    if (!hasRefundRequest)
                    {
                        var refundReq = new RefundRequest(
                            ticket.EventId,
                            ticket.Id,
                            data.Amount,
                            $"orphaned-comp-{data.OrderCode}"
                        );
                        var destination = await _context.RefundBankAccounts.AsNoTracking()
                            .SingleOrDefaultAsync(x => x.UserId == ticket.UserId, cancellationToken);
                        if (destination is null) refundReq.WaitForDestination();
                        else refundReq.SetDestinationSnapshot(destination.EncryptedPayload);
                        _context.RefundRequests.Add(refundReq);
                    }

                    if (!lease.IsValid) return false;
                    await _context.SaveChangesAsync(cancellationToken);
                    if (_catalogCache is not null) await _catalogCache.InvalidateAsync(cancellationToken);

                    if (isHoldExpired && ticket.Seat != null)
                    {
                        await _notificationService.NotifySeatStatusChanged(ticket.EventId, ticket.SeatId, ticket.Seat.Status.ToString());
                    }

                    return true; // Acknowledge webhook to avoid endless retries while preserving compensation state
                }

                if (isHoldExpired)
                {
                    ticket.Cancel();
                    if (ticket.Seat != null)
                    {
                        ticket.Seat.Release();
                    }
                    if (lease.IsValid)
                    {
                        await _context.SaveChangesAsync(cancellationToken);
                        if (ticket.Seat != null)
                        {
                            await _notificationService.NotifySeatStatusChanged(ticket.EventId, ticket.SeatId, ticket.Seat.Status.ToString());
                        }
                    }
                }

                _logger.LogWarning("Cannot process failed payment webhook for ticket {TicketId} with status {Status}.", ticket.Id, ticket.Status);
                // Terminal failed callbacks are safely idempotent: there is no
                // pending reservation left to mutate, so acknowledge them and
                // prevent the provider from retrying forever.
                return true;
            }

            if (data.Success)
            {
                // Invariant 3: Amount and currency validation
                if (!PaymentWebhookPolicy.IsAmountValid(ticket.Price, data))
                {
                    _logger.LogCritical("Payment amount tampering detected for ticket {TicketId}, order {OrderCode}! Expected {Expected}, got {Actual}.", 
                        ticket.Id, data.OrderCode, ticket.Price, data.Amount);
                    return false;
                }

                // 2. Generate cryptographically signed QR code token
                var expiresAt = ticket.Event?.EndDate.AddHours(6) ?? _time.UtcNow.AddDays(30);
                string qrToken = _ticketSecurityService.GenerateSignedQrToken(
                    ticket.Id, 
                    ticket.EventId, 
                    ticket.OrderCode, 
                    expiresAt);

                ticket.MarkAsPaid(qrToken);

                if (ticket.Seat != null)
                {
                    ticket.Seat.MarkAsSold();
                }

                // 3. Record or update PaymentTransaction
                if (existingTx == null)
                {
                    var transaction = new PaymentTransaction(
                        ticket.OrderCode,
                        ticket.Id,
                        ticket.Price,
                        "VietQR_PayOS"
                    );
                    transaction.MarkSuccess(providerTxId, auditSummary);
                    transaction.SetWebhookPayloadHash(data.PayloadHash);
                    _context.PaymentTransactions.Add(transaction);
                }
                else
                {
                    existingTx.MarkSuccess(providerTxId, auditSummary);
                    existingTx.SetWebhookPayloadHash(data.PayloadHash);
                }
                // Stage notification outbox item into the same unit of work
                if (!await _context.NotificationOutbox.AnyAsync(x => x.TicketId == ticket.Id, cancellationToken))
                {
                    _context.NotificationOutbox.Add(new NotificationOutboxItem(ticket.Id, ticket.UserId, ticket.EventId));
                }

                // Explicitly commit financial, seat state, and outbox atomically into database
                if (!lease.IsValid) return false;
                await _context.SaveChangesAsync(cancellationToken);
                if (_catalogCache is not null) await _catalogCache.InvalidateAsync(cancellationToken);

                if (ticket.Seat != null)
                {
                    await _notificationService.NotifySeatStatusChanged(ticket.EventId, ticket.SeatId, ticket.Seat.Status.ToString());
                }

            }
            else
            {
                // Payment failed: Release seat and cancel ticket
                ticket.Cancel();
                if (ticket.Seat != null)
                {
                    ticket.Seat.Release();
                }

                if (existingTx == null)
                {
                    var transaction = new PaymentTransaction(
                        ticket.OrderCode,
                        ticket.Id,
                        ticket.Price,
                        "VietQR_PayOS"
                    );
                    transaction.MarkFailed("Payment rejected or cancelled by user", auditSummary);
                    transaction.SetWebhookPayloadHash(data.PayloadHash);
                    _context.PaymentTransactions.Add(transaction);
                }
                else
                {
                    existingTx.MarkFailed("Payment rejected or cancelled by user", auditSummary);
                    existingTx.SetWebhookPayloadHash(data.PayloadHash);
                }

                if (!lease.IsValid) return false;
                await _context.SaveChangesAsync(cancellationToken);
                if (_catalogCache is not null) await _catalogCache.InvalidateAsync(cancellationToken);

                if (ticket.Seat != null)
                {
                    await _notificationService.NotifySeatStatusChanged(ticket.EventId, ticket.SeatId, ticket.Seat.Status.ToString());
                }
            }

            return true;
        }
    }
}
