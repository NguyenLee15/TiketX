using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TickeX.Infrastructure.Migrations;

public partial class AddPaymentCheckoutUrl : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CheckoutUrl",
            table: "payment_transactions",
            type: "nvarchar(2048)",
            maxLength: 2048,
            nullable: false,
            defaultValue: "");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "CheckoutUrl", table: "payment_transactions");
    }
}
