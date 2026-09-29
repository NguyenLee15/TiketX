using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public sealed class RefundBankAccountConfiguration : IEntityTypeConfiguration<RefundBankAccount>
{
    public void Configure(EntityTypeBuilder<RefundBankAccount> builder)
    {
        builder.ToTable("refund_bank_accounts");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.EncryptedPayload).HasMaxLength(4000).IsRequired();
        builder.Property(x => x.AccountLastFour).HasMaxLength(4).IsRequired();
        builder.HasIndex(x => x.UserId).IsUnique();
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
