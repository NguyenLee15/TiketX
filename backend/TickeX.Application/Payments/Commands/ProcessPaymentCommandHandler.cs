using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Payments.Commands;

public class ProcessPaymentCommandHandler : IRequestHandler<ProcessPaymentCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationOutboxPort _notificationOutbox;
    private readonly ISeatNotificationService _notificationService;
    private readonly IDistributedLockService _lockService;
    private readonly ITicketSecurityService _ticketSecurityService;
    private readonly ILogger<ProcessPaymentCommandHandler> _logger;
    private readonly ITimePolicy _time;

    public ProcessPaymentCommandHandler(
        IApplicationDbContext context, 
        INotificationOutboxPort notificationOutbox, 
        ISeatNotificationService notificationService, 
        IDistributedLockService lockService,
        ITicketSecurityService ticketSecurityService,
        ILogger<ProcessPaymentCommandHandler> logger,
        ITimePolicy? time = null)
    {
        _context = context;
        _notificationOutbox = notificationOutbox;
        _notificationService = notificationService;
        _lockService = lockService;
        _ticketSecurityService = ticketSecurityService;
        _logger = logger;
        _time = time ?? new UtcTimePolicy();
    }

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

            string providerTxId = !string.IsNullOrWhiteSpace(data.Reference) 
                ? data.Reference 
                : (!string.IsNullOrWhiteSpace(data.PaymentLinkId) ? data.PaymentLinkId : data.OrderCode.ToString());
            var auditSummary = PaymentAudit.CreateWebhookSummary(data.OrderCode, data.Amount, providerTxId, data.Code);

            // Invariant 2: Ticket must be Pending to process payment
            if (ticket.Status != TicketStatus.Pending)
            {
                if (data.Success)
                {
                    _logger.LogError("ORPHANED PAYMENT DETECTED: Order {OrderCode}, Ticket {TicketId}, Amount {Amount}. Ticket status is {Status}. Money captured but reservation hold expired or invalid. Recording OrphanedPaid transaction for compensation.",
                        data.OrderCode, ticket.Id, data.Amount, ticket.Status);

                    if (existingTx == null)
                    {
                        var transaction = new PaymentTransaction(
                            ticket.OrderCode,
                            ticket.Id,
                            data.Amount,
                            "VietQR_PayOS"
                        );
                        transaction.MarkOrphaned($"Hold expired or invalid status: {ticket.Status}", providerTxId, auditSummary);
                        _context.PaymentTransactions.Add(transaction);
                    }
                    else
                    {
                        existingTx.MarkOrphaned($"Hold expired or invalid status: {ticket.Status}", providerTxId, auditSummary);
                    }

                    var audit = new AuditLog(
                        ticket.UserId,
                        "system@tickex.internal",
                        "ORPHANED_PAYMENT_DETECTED",
                        "PaymentTransaction",
                        data.OrderCode.ToString(),
                        $"TicketStatus: {ticket.Status}",
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
                    return true; // Acknowledge webhook to avoid endless retries while preserving compensation state
                }

                _logger.LogWarning("Cannot process failed payment webhook for ticket {TicketId} with status {Status}.", ticket.Id, ticket.Status);
                return false;
            }

            if (data.Success)
            {
                // Invariant 3: Amount and currency validation
                if (data.Amount != ticket.Price)
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
                    _context.PaymentTransactions.Add(transaction);
                }
                else
                {
                    existingTx.MarkSuccess(providerTxId, auditSummary);
                }
                // Stage notification outbox item into the same unit of work
                if (!await _context.NotificationOutbox.AnyAsync(x => x.TicketId == ticket.Id, cancellationToken))
                {
                    _context.NotificationOutbox.Add(new NotificationOutboxItem(ticket.Id, ticket.UserId, ticket.EventId));
                }

                // Explicitly commit financial, seat state, and outbox atomically into database
                if (!lease.IsValid) return false;
                await _context.SaveChangesAsync(cancellationToken);

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
                    _context.PaymentTransactions.Add(transaction);
                }
                else
                {
                    existingTx.MarkFailed("Payment rejected or cancelled by user", auditSummary);
                }

                if (!lease.IsValid) return false;
                await _context.SaveChangesAsync(cancellationToken);

                if (ticket.Seat != null)
                {
                    await _notificationService.NotifySeatStatusChanged(ticket.EventId, ticket.SeatId, ticket.Seat.Status.ToString());
                }
            }

            return true;
        }
    }
}
