using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using TickeX.Infrastructure.Persistence;

#nullable disable

namespace TickeX.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260909200000_AddNotificationOutbox")]
public partial class AddNotificationOutbox : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("IF OBJECT_ID(N'notification_outbox', N'U') IS NULL CREATE TABLE [notification_outbox] ([Id] uniqueidentifier NOT NULL CONSTRAINT [PK_notification_outbox] PRIMARY KEY, [TicketId] uniqueidentifier NOT NULL, [UserId] uniqueidentifier NOT NULL, [EventId] uniqueidentifier NOT NULL, [Status] nvarchar(30) NOT NULL, [AttemptCount] int NOT NULL, [NextAttemptAt] datetime2 NULL, [ProcessedAt] datetime2 NULL, [LastError] nvarchar(2000) NULL, [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL)");
        migrationBuilder.Sql("IF OBJECT_ID(N'notification_outbox', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_notification_outbox_TicketId' AND object_id = OBJECT_ID(N'notification_outbox')) CREATE UNIQUE INDEX [IX_notification_outbox_TicketId] ON [notification_outbox] ([TicketId])");
        migrationBuilder.Sql("IF OBJECT_ID(N'notification_outbox', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_notification_outbox_Status_NextAttemptAt' AND object_id = OBJECT_ID(N'notification_outbox')) CREATE INDEX [IX_notification_outbox_Status_NextAttemptAt] ON [notification_outbox] ([Status], [NextAttemptAt])");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "notification_outbox");
    }
}
