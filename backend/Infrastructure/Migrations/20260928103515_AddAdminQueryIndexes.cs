using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TickeX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminQueryIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_users_CreatedAt_Id",
                table: "users",
                columns: new[] { "CreatedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_CreatedAt_Id",
                table: "refund_requests",
                columns: new[] { "CreatedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_events_Date_Id",
                table: "events",
                columns: new[] { "Date", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_CreatedAt_Id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_refund_requests_CreatedAt_Id",
                table: "refund_requests");

            migrationBuilder.DropIndex(
                name: "IX_events_Date_Id",
                table: "events");
        }
    }
}
