using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> builder)
    {
        builder.ToTable("events");
        builder.HasKey(e => e.Id);
        
        builder.Property(e => e.Title).IsRequired().HasMaxLength(250);
        builder.Property(e => e.Description).HasMaxLength(3000);
        builder.Property(e => e.Location).IsRequired().HasMaxLength(250);
        builder.Property(e => e.VenueName).HasMaxLength(250);
        builder.Property(e => e.Category).IsRequired().HasMaxLength(100);
        builder.Property(e => e.OrganizerName).HasMaxLength(200);
        builder.Property(e => e.ImageUrl).HasMaxLength(1000);
        builder.Property(e => e.BannerUrl).HasMaxLength(1000);
        builder.Property(e => e.BasePrice).HasPrecision(18, 2);
        builder.Property(e => e.Version).IsRequired().IsConcurrencyToken();

        builder.HasMany(e => e.Seats)
            .WithOne(s => s.Event)
            .HasForeignKey(s => s.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.Date);
        builder.HasIndex(e => e.Category);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.IsDeleted);
        builder.HasIndex(e => new { e.Status, e.Date });

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
