using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Application.Admin.Commands;

public record ChangeUserRoleCommand(
    Guid UserId, 
    string NewRole, 
    Guid? PerformedByAdminId = null,
    string AdminEmail = "admin@tickex.com",
    string? IpAddress = null,
    byte[]? ExpectedVersion = null
) : IRequest<AdminOperationResult>;

public class ChangeUserRoleCommandHandler : IRequestHandler<ChangeUserRoleCommand, AdminOperationResult>
{
    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Admin", "Staff", "Customer"
    };

    private readonly IApplicationDbContext _context;
    private readonly IDistributedLockService _lockService;
    private readonly IRefreshTokenStore? _refreshTokens;

    public ChangeUserRoleCommandHandler(IApplicationDbContext context, IDistributedLockService lockService, IRefreshTokenStore? refreshTokens = null)
    {
        _context = context;
        _lockService = lockService;
        _refreshTokens = refreshTokens;
    }

    public async Task<AdminOperationResult> Handle(ChangeUserRoleCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.NewRole) || !AllowedRoles.Contains(request.NewRole.Trim()))
        {
            return AdminOperationResult.BadRequest($"Vai trò '{request.NewRole}' không hợp lệ. Chỉ chấp nhận Admin, Staff, Customer.", "INVALID_ROLE");
        }

        var normalizedRole = request.NewRole.Trim();
        if (string.Equals(normalizedRole, "admin", StringComparison.OrdinalIgnoreCase)) normalizedRole = "Admin";
        else if (string.Equals(normalizedRole, "staff", StringComparison.OrdinalIgnoreCase)) normalizedRole = "Staff";
        else normalizedRole = "Customer";

        // Admin cannot demote their own account
        if (request.PerformedByAdminId.HasValue && request.PerformedByAdminId.Value == request.UserId && normalizedRole != "Admin")
        {
            return AdminOperationResult.BadRequest("Quản trị viên không thể tự hạ quyền của chính mình.", "CANNOT_DEMOTE_SELF");
        }

        // Distributed lock to prevent race condition when concurrent requests could eliminate the last remaining Admin
        var lockKey = "lock:admin_role_mutation";
        bool lockAcquired;
        try
        {
            lockAcquired = await _lockService.AcquireLockAsync(lockKey, TimeSpan.FromSeconds(5), cancellationToken);
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

            if (user.Role == normalizedRole)
            {
                return AdminOperationResult.Ok($"Người dùng đã có vai trò {normalizedRole}.");
            }

            // Invariant: If demoting an existing active Admin, verify there is at least 1 other active Admin
            if (user.Role == "Admin" && normalizedRole != "Admin")
            {
                var activeAdminCount = await _context.Users
                    .CountAsync(u => u.Role == "Admin" && !u.IsBlocked, cancellationToken);

                if (activeAdminCount <= 1)
                {
                    return AdminOperationResult.BadRequest(
                        "Không thể hạ quyền Quản trị viên duy nhất còn lại trong hệ thống.",
                        "CANNOT_MODIFY_LAST_ADMIN"
                    );
                }
            }

            var oldRole = user.Role;
            var oldVersion = Convert.ToBase64String(user.Version);
            user.ChangeRole(normalizedRole);

            var audit = new AuditLog(
                userId: request.PerformedByAdminId,
                userEmail: request.AdminEmail,
                action: "CHANGE_ROLE",
                entityName: "User",
                entityId: user.Id.ToString(),
                beforeState: $"Role={oldRole};Version={oldVersion}",
                afterState: $"Role={normalizedRole};Version={Convert.ToBase64String(user.Version)}",
                ipAddress: request.IpAddress
            );
            _context.AuditLogs.Add(audit);

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
                if (_refreshTokens is not null)
                    await _refreshTokens.RevokeAllForUserAsync(user.Id, cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return AdminOperationResult.Conflict(
                    "Người dùng vừa được quản trị viên khác cập nhật. Vui lòng tải lại và thử lại.",
                    "CONCURRENCY_CONFLICT");
            }

            return AdminOperationResult.Ok($"Đã thay đổi vai trò của người dùng thành {normalizedRole}.");
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
