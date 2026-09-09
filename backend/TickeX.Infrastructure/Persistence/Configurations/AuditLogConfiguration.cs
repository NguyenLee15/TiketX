using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");
        builder.HasKey(al => al.Id);

        builder.Property(al => al.UserEmail).HasMaxLength(256);
        builder.Property(al => al.Action).HasMaxLength(100);
        builder.Property(al => al.EntityName).HasMaxLength(100);
        builder.Property(al => al.EntityId).HasMaxLength(100);
        builder.Property(al => al.IpAddress).HasMaxLength(100);
        builder.Property(al => al.BeforeState).HasMaxLength(4000);
        builder.Property(al => al.AfterState).HasMaxLength(4000);

        builder.HasIndex(al => al.TimestampUtc);
        builder.HasIndex(al => al.Action);
        builder.HasIndex(al => al.UserId);
        builder.HasIndex(al => new { al.EntityName, al.EntityId });
    }
}

