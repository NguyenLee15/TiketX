using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class SeatConfiguration : IEntityTypeConfiguration<Seat>
{
    public void Configure(EntityTypeBuilder<Seat> builder)
    {
        builder.ToTable("seats");
        builder.HasKey(s => s.Id);
        
        builder.Property(s => s.Row).IsRequired().HasMaxLength(10);
        builder.Property(s => s.Price).HasPrecision(18, 2);

        // Concurrency Token
        builder.Property(s => s.Version).IsConcurrencyToken();

        builder.HasIndex(s => new { s.EventId, s.Status });
        builder.HasIndex(s => new { s.EventId, s.Row, s.Number }).IsUnique();

        builder.HasQueryFilter(s => s.Event == null || !s.Event.IsDeleted);
    }
}
