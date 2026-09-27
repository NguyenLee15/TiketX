using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TickeX.Infrastructure.Migrations;

public partial class RepairEventVersionColumn : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("IF COL_LENGTH(N'[events]', N'Version') IS NULL ALTER TABLE [events] ADD [Version] rowversion NOT NULL;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
