using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Application.Admin.Commands;

public record BlockUserCommand(
    Guid UserId, 
    bool IsBlocked, 
    Guid? PerformedByAdminId = null,
    string AdminEmail = "admin@tickex.com",
    string? IpAddress = null,
    byte[]? ExpectedVersion = null
) : IRequest<AdminOperationResult>;

public class BlockUserCommandHandler : IRequestHandler<BlockUserCommand, AdminOperationResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IDistributedLockService _lockService;
    private readonly IRefreshTokenStore? _refreshTokens;

    public BlockUserCommandHandler(IApplicationDbContext context, IDistributedLockService lockService, IRefreshTokenStore? refreshTokens = null)
    {
        _context = context;
        _lockService = lockService;
        _refreshTokens = refreshTokens;
    }

    public async Task<AdminOperationResult> Handle(BlockUserCommand request, CancellationToken cancellationToken)
    {
        // Admin cannot block their own account
        if (request.PerformedByAdminId.HasValue && request.PerformedByAdminId.Value == request.UserId && request.IsBlocked)
        {
            return AdminOperationResult.BadRequest("Quản trị viên không thể tự khóa tài khoản của chính mình.", "CANNOT_BLOCK_SELF");
        }

        var lockKey = "lock:admin_role_mutation";
        bool lockAcquired;
        try
        {
            lockAcquired = await _lockService.AcquireLockAsync(lockKey, TimeSpan.FromSeconds(30), cancellationToken);
        }
        catch
        {
            return AdminOperationResult.Conflict("Không thể khóa thao tác quản trị lúc này. Vui lòng thử lại.", "ADMIN_LOCK_UNAVAILABLE");
        }
        if (!lockAcquired)
            return AdminOperationResult.Conflict("Không thể khóa thao tác quản trị lúc này. Vui lòng thử lại.", "ADMIN_LOCK_UNAVAILABLE");

        try
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null) 
                return AdminOperationResult.NotFound("Không tìm thấy người dùng.");

            if (request.ExpectedVersion is not null && !user.Version.SequenceEqual(request.ExpectedVersion))
            {
                return AdminOperationResult.Conflict(
                    "Người dùng vừa được quản trị viên khác cập nhật. Vui lòng tải lại và thử lại.",
                    "CONCURRENCY_CONFLICT");
            }

            if (user.IsBlocked == request.IsBlocked)
            {
                return AdminOperationResult.Ok(request.IsBlocked ? "Tài khoản đã bị khóa trước đó." : "Tài khoản đang hoạt động.");
            }

            // Invariant: If blocking an Admin, check that at least one other unblocked Admin remains
            if (request.IsBlocked && user.Role == "Admin")
            {
                var activeAdminCount = await _context.Users
                    .CountAsync(u => u.Role == "Admin" && !u.IsBlocked, cancellationToken);

                if (activeAdminCount <= 1)
                {
                    return AdminOperationResult.BadRequest(
                        "Không thể khóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống.",
                        "CANNOT_MODIFY_LAST_ADMIN"
                    );
                }
            }

            var beforeState = $"IsBlocked={user.IsBlocked}";
            var oldVersion = Convert.ToBase64String(user.Version);
            if (request.IsBlocked)
                user.Block();
            else
                user.Unblock();

            var audit = new AuditLog(
                userId: request.PerformedByAdminId,
                userEmail: request.AdminEmail,
                action: request.IsBlocked ? "BLOCK_USER" : "UNBLOCK_USER",
                entityName: "User",
                entityId: user.Id.ToString(),
                beforeState: $"{beforeState};Version={oldVersion}",
                afterState: $"IsBlocked={user.IsBlocked};Version={Convert.ToBase64String(user.Version)}",
                ipAddress: request.IpAddress
            );
            _context.AuditLogs.Add(audit);

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
                if (request.IsBlocked && _refreshTokens is not null)
                    await _refreshTokens.RevokeAllForUserAsync(user.Id, cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return AdminOperationResult.Conflict(
                    "Người dùng vừa được quản trị viên khác cập nhật. Vui lòng tải lại và thử lại.",
                    "CONCURRENCY_CONFLICT");
            }

            var actionName = request.IsBlocked ? "Khóa" : "Mở khóa";
            return AdminOperationResult.Ok($"{actionName} tài khoản người dùng thành công.");
        }
        finally
        {
            if (lockAcquired)
            {
                try
                {
                    await _lockService.ReleaseLockAsync(lockKey);
                }
                catch
                {
                    // The mutation already completed; a release failure must not
                    // turn a successful admin operation into a 500 response.
                }
            }
        }
    }
}
