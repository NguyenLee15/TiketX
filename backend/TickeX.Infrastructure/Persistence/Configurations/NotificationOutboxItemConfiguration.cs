using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;
namespace TickeX.Infrastructure.Persistence.Configurations;
public sealed class NotificationOutboxItemConfiguration : IEntityTypeConfiguration<NotificationOutboxItem>
{
    public void Configure(EntityTypeBuilder<NotificationOutboxItem> builder)
    {
        builder.ToTable("notification_outbox"); builder.HasKey(x => x.Id);
        builder.Property(x => x.Status).HasMaxLength(30).IsRequired().IsConcurrencyToken(); builder.Property(x => x.LastError).HasMaxLength(2000);
        builder.HasIndex(x => x.TicketId).IsUnique(); builder.HasIndex(x => new { x.Status, x.NextAttemptAt });
    }
}
