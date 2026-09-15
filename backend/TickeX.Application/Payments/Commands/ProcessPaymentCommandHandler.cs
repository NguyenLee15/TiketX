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
        bool acquired = false;
        try
        {
            acquired = await _lockService.AcquireLockAsync(lockKey, TimeSpan.FromSeconds(30), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Required payment lock is unavailable for {OrderCode}; leaving webhook unprocessed for retry.", data.OrderCode);
            return false;
        }

        if (!acquired)
        {
            _logger.LogWarning("Could not acquire payment lock for {OrderCode}; leaving webhook unprocessed for retry.", data.OrderCode);
            return false;
        }

        try
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

            // Invariant 2: Ticket must be Pending to process payment
            if (ticket.Status != TicketStatus.Pending)
            {
                _logger.LogWarning("Cannot process payment for ticket {TicketId} with status {Status}.", ticket.Id, ticket.Status);
                return false;
            }

            string providerTxId = !string.IsNullOrWhiteSpace(data.Reference) 
                ? data.Reference 
                : (!string.IsNullOrWhiteSpace(data.PaymentLinkId) ? data.PaymentLinkId : data.OrderCode.ToString());
            var auditSummary = PaymentAudit.CreateWebhookSummary(data.OrderCode, data.Amount, providerTxId, data.Code);

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

                await _notificationOutbox.QueueTicketPaidAsync(ticket.Id, ticket.UserId, ticket.EventId, cancellationToken);

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

                await _context.SaveChangesAsync(cancellationToken);

                if (ticket.Seat != null)
                {
                    await _notificationService.NotifySeatStatusChanged(ticket.EventId, ticket.SeatId, ticket.Seat.Status.ToString());
                }
            }

            return true;
        }
        finally
        {
            try
            {
                await _lockService.ReleaseLockAsync(lockKey);
            }
            catch { }
        }
    }
}
