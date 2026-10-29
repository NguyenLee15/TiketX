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

    public void UpdatePriceFromBase(decimal basePrice)
    {
        if (basePrice <= 0)
            throw new ArgumentOutOfRangeException(nameof(basePrice), "Base price must be positive.");

        decimal multiplier = Tier switch
        {
            SeatTier.VIP => 1.75m,
            SeatTier.Standard => 1.0m,
            SeatTier.Economy => 0.75m,
            _ => 1.0m
        };

        Price = Math.Round(basePrice * multiplier, 0);
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Lock(Guid userId, DateTime utcNow)
    {
        if (Status != SeatStatus.Available)
            throw new InvalidOperationException("Seat is not available for reservation.");

        Status = SeatStatus.Locked;
        LockedByUserId = userId;
        LockedAt = utcNow;
        UpdatedAt = utcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Lock(Guid userId) => Lock(userId, DateTime.UtcNow);

    public bool IsLockExpired(TimeSpan duration, DateTime utcNow)
    {
        return Status == SeatStatus.Locked 
            && LockedAt.HasValue 
            && LockedAt.Value.Add(duration) <= utcNow;
    }

    public bool IsLockExpired(TimeSpan duration) => IsLockExpired(duration, DateTime.UtcNow);

    public void ReclaimLock(Guid userId, DateTime utcNow)
    {
        if (Status != SeatStatus.Locked)
            throw new InvalidOperationException("Seat lock can only be reclaimed when currently locked.");

        LockedByUserId = userId;
        LockedAt = utcNow;
        UpdatedAt = utcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void ReclaimLock(Guid userId) => ReclaimLock(userId, DateTime.UtcNow);

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
