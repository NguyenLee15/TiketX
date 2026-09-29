using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TickeX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenSecurityStamp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SecurityStamp",
                table: "refresh_tokens",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE refresh_tokens
                SET SecurityStamp = users.SecurityStamp
                FROM users
                WHERE refresh_tokens.UserId = users.Id;");

            migrationBuilder.Sql(@"
                UPDATE refresh_tokens
                SET SecurityStamp = ''
                WHERE SecurityStamp IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "SecurityStamp",
                table: "refresh_tokens",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(128)",
                oldMaxLength: 128,
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SecurityStamp",
                table: "refresh_tokens");
        }
    }
}
