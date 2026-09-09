using TickeX.Domain.Enums;

namespace TickeX.Domain.Entities;

public class Seat : BaseEntity
{
    public Guid EventId { get; private set; }
    public string Row { get; private set; } = string.Empty;
    public int Number { get; private set; }
    public decimal Price { get; private set; }
    public SeatTier Tier { get; private set; } = SeatTier.Standard;
    public SeatStatus Status { get; private set; }
    
    public Guid? LockedByUserId { get; private set; }
    public DateTime? LockedAt { get; private set; }

    public Event Event { get; private set; } = null!;

    // Concurrency Token for Optimistic Locking
    public byte[] Version { get; private set; } = Guid.NewGuid().ToByteArray();

    private Seat() { } // For EF Core

    public Seat(Guid eventId, string row, int number, decimal price, SeatTier tier = SeatTier.Standard)
    {
        EventId = eventId;
        Row = row;
        Number = number;
        Price = price;
        Tier = tier;
        Status = SeatStatus.Available;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Lock(Guid userId)
    {
        if (Status != SeatStatus.Available)
            throw new InvalidOperationException("Seat is not available for reservation.");

        Status = SeatStatus.Locked;
        LockedByUserId = userId;
        LockedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public bool IsLockExpired(TimeSpan duration)
    {
        return Status == SeatStatus.Locked 
            && LockedAt.HasValue 
            && LockedAt.Value.Add(duration) <= DateTime.UtcNow;
    }

    public void ReclaimLock(Guid userId)
    {
        if (Status != SeatStatus.Locked)
            throw new InvalidOperationException("Seat lock can only be reclaimed when currently locked.");

        LockedByUserId = userId;
        LockedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void MarkAsSold()
    {
        if (Status != SeatStatus.Locked && Status != SeatStatus.Available)
            throw new InvalidOperationException("Seat cannot be marked as sold from its current status.");

        Status = SeatStatus.Sold;
        LockedByUserId = null;
        LockedAt = null;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }
    
    public void Release()
    {
        Status = SeatStatus.Available;
        LockedByUserId = null;
        LockedAt = null;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }
}
