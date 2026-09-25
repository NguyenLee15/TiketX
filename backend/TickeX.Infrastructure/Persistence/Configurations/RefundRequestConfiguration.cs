using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class RefundRequestConfiguration : IEntityTypeConfiguration<RefundRequest>
{
    public void Configure(EntityTypeBuilder<RefundRequest> builder)
    {
        builder.ToTable("refund_requests");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Amount).HasPrecision(18, 2).IsRequired();
        builder.Property(x => x.IdempotencyKey).HasMaxLength(180).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(30).IsRequired();
        builder.Property(x => x.LastError).HasMaxLength(2000);
        builder.Property(x => x.EncryptedDestinationSnapshot).HasMaxLength(4000);
        builder.Property(x => x.ProviderReference).HasMaxLength(180);
        builder.Property(x => x.ProviderStatus).HasMaxLength(40);
        builder.Property(x => x.LeaseOwner).HasMaxLength(80);
        builder.HasIndex(x => x.IdempotencyKey).IsUnique();
        builder.HasIndex(x => new { x.Status, x.NextAttemptAt });
        builder.HasIndex(x => x.TicketId);
        builder.HasIndex(x => x.EventId);
    }
}
