using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("tickets");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Price).HasPrecision(18, 2);
        builder.Property(t => t.RefundAmount).HasPrecision(18, 2);
        builder.Property(t => t.QrCodeSignature).HasMaxLength(1000);

        // Concurrency Token
        builder.Property(t => t.Version).IsConcurrencyToken();

        builder.HasOne(t => t.Event)
            .WithMany()
            .HasForeignKey(t => t.EventId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.Seat)
            .WithMany()
            .HasForeignKey(t => t.SeatId)
            .OnDelete(DeleteBehavior.Restrict);
            
        builder.HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(t => t.OrderCode).IsUnique();
        builder.HasIndex(t => t.UserId);
        builder.HasIndex(t => t.EventId);
        builder.HasIndex(t => t.Status);
        builder.HasIndex(t => t.CheckedInByStaffId);
        builder.HasIndex(t => new { t.Status, t.PaidAt });
        builder.HasIndex(t => new { t.EventId, t.Status });

        builder.HasQueryFilter(t => t.Event == null || !t.Event.IsDeleted);
    }
}
