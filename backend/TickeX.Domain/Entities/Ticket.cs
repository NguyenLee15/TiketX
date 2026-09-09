using System.Security.Cryptography;
using TickeX.Domain.Enums;

namespace TickeX.Domain.Entities;

public class Ticket : BaseEntity
{
    public Guid EventId { get; private set; }
    public Guid SeatId { get; private set; }
    public Guid UserId { get; private set; }
    
    public decimal Price { get; private set; }
    public TicketStatus Status { get; private set; }
    public long OrderCode { get; private set; }
    public string QrCodeSignature { get; private set; } = string.Empty;
    
    public DateTime? PaidAt { get; private set; }
    public DateTime? CheckedInAt { get; private set; }
    public Guid? CheckedInByStaffId { get; private set; }
    public decimal? RefundAmount { get; private set; }
    public DateTime? RefundedAt { get; private set; }

    // Concurrency Token to prevent race condition between Check-in and Refund
    public byte[] Version { get; private set; } = Guid.NewGuid().ToByteArray();

    public Event Event { get; private set; } = null!;
    public Seat Seat { get; private set; } = null!;
    public User User { get; private set; } = null!;

    private Ticket() { } // For EF Core

    public Ticket(Guid eventId, Guid seatId, Guid userId, decimal price)
    {
        EventId = eventId;
        SeatId = seatId;
        UserId = userId;
        Price = price;
        Status = TicketStatus.Pending;
        var suffix = RandomNumberGenerator.GetInt32(1000, 9999);
        OrderCode = long.Parse(DateTimeOffset.UtcNow.ToString("yyMMddHHmmss") + suffix.ToString());
        Version = Guid.NewGuid().ToByteArray();
    }

    public void MarkAsPaid(string qrCodeSignature = "")
    {
        if (Status != TicketStatus.Pending)
            throw new InvalidOperationException("Ticket can only be marked as paid when it is pending.");

        Status = TicketStatus.Paid;
        PaidAt = DateTime.UtcNow;
        // A payment transition must not erase a signature that was generated
        // immediately before the state change. Keep the optional argument for
        // backwards compatibility with callers that mark a ticket as paid
        // without a token (legacy/import flows).
        if (!string.IsNullOrWhiteSpace(qrCodeSignature))
        {
            QrCodeSignature = qrCodeSignature;
        }
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void SetQrSignature(string qrCodeSignature)
    {
        QrCodeSignature = qrCodeSignature;
        UpdatedAt = DateTime.UtcNow;
    }

    public void CheckIn(Guid? staffUserId = null)
    {
        if (Status == TicketStatus.Used)
            throw new InvalidOperationException($"Ticket was already checked in at {CheckedInAt:HH:mm:ss dd/MM/yyyy}.");

        if (Status != TicketStatus.Paid)
            throw new InvalidOperationException("Only paid tickets can be checked in.");

        Status = TicketStatus.Used;
        CheckedInAt = DateTime.UtcNow;
        CheckedInByStaffId = staffUserId;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Refund(decimal amount)
    {
        if (Status != TicketStatus.Paid)
            throw new InvalidOperationException("Only paid tickets can be refunded.");

        Status = TicketStatus.Cancelled;
        RefundAmount = amount;
        RefundedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void MarkRefundPending()
    {
        if (Status != TicketStatus.Paid)
            throw new InvalidOperationException("Only paid tickets can await a refund.");
        Status = TicketStatus.RefundPending;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Cancel()
    {
        if (Status == TicketStatus.Cancelled)
            return;

        Status = TicketStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }
}
