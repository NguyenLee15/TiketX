using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TickeX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEventIsDeletedAndIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "events",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_events_IsDeleted",
                table: "events",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_events_Status_Date",
                table: "events",
                columns: new[] { "Status", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_events_IsDeleted",
                table: "events");

            migrationBuilder.DropIndex(
                name: "IX_events_Status_Date",
                table: "events");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "events");
        }
    }
}
