using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Id);
        
        builder.Property(u => u.Name).IsRequired().HasMaxLength(150);
        builder.Property(u => u.Email).IsRequired().HasMaxLength(150);
        builder.Property(u => u.Role).IsRequired().HasMaxLength(50);
        builder.Property(u => u.Phone).HasMaxLength(30);
        builder.Property(u => u.AvatarUrl).HasMaxLength(500);

        builder.Property(u => u.SecurityStamp)
            .IsRequired()
            .HasMaxLength(100)
            .HasDefaultValueSql("CAST(NEWID() AS NVARCHAR(100))");

        builder.Property(u => u.Version)
            .IsRequired()
            .IsConcurrencyToken();

        builder.Property(u => u.AccessFailedCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(u => u.LockoutEnd)
            .IsRequired(false);

        builder.HasIndex(u => u.Email).IsUnique();
        builder.HasIndex(u => u.Role);
    }
}
