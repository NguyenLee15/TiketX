namespace TickeX.Domain.Entities;

public class EventStaffAssignment : BaseEntity
{
    public Guid EventId { get; private set; }
    public Guid StaffUserId { get; private set; }
    public DateTime AssignedAt { get; private set; } = DateTime.UtcNow;

    public Event? Event { get; private set; }
    public User? StaffUser { get; private set; }

    private EventStaffAssignment() { } // For EF Core

    public EventStaffAssignment(Guid eventId, Guid staffUserId)
    {
        EventId = eventId;
        StaffUserId = staffUserId;
        AssignedAt = DateTime.UtcNow;
    }
}

