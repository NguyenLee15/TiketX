using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Persistence.Configurations;

public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> builder)
    {
        builder.ToTable("payment_transactions");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Amount).HasPrecision(18, 2);
        builder.Property(p => p.Provider).HasMaxLength(50);
        builder.Property(p => p.ProviderTransactionId).HasMaxLength(150);
        builder.Property(p => p.Status).IsRequired().HasMaxLength(50);
        builder.Property(p => p.RawWebhookPayload).HasMaxLength(4000);
        builder.Property(p => p.CheckoutUrl).HasMaxLength(2048);

        builder.HasIndex(p => p.OrderCode).IsUnique();
        builder.HasIndex(p => new { p.Provider, p.ProviderTransactionId });
        builder.HasIndex(p => p.TicketId);
        builder.HasIndex(p => p.Status);
    }
}
