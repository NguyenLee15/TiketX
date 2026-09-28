using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TickeX.Infrastructure.Migrations;

public partial class WidenSeatConcurrencyVersion : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Expand-only repair for the legacy migration that recreated this column as varbinary(8).
        // Existing bytes are preserved; no drop/rename operation is used here.
        migrationBuilder.AlterColumn<byte[]>(
            name: "Version",
            table: "seats",
            type: "varbinary(max)",
            nullable: false,
            oldClrType: typeof(byte[]),
            oldType: "varbinary(8)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        throw new NotSupportedException(
            "Reverting seats.Version to varbinary(8) can truncate concurrency tokens. Deploy a reviewed forward migration instead.");
    }
}
