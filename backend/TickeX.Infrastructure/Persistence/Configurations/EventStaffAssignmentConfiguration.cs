using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class EventStaffAssignmentConfiguration : IEntityTypeConfiguration<EventStaffAssignment>
{
    public void Configure(EntityTypeBuilder<EventStaffAssignment> builder)
    {
        builder.ToTable("event_staff_assignments");
        builder.HasKey(esa => esa.Id);

        builder.HasOne(esa => esa.Event)
            .WithMany()
            .HasForeignKey(esa => esa.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(esa => esa.StaffUser)
            .WithMany()
            .HasForeignKey(esa => esa.StaffUserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(esa => new { esa.EventId, esa.StaffUserId }).IsUnique();

        builder.HasQueryFilter(esa => esa.Event == null || !esa.Event.IsDeleted);
    }
}
