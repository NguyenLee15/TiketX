using FluentValidation;

namespace TickeX.Application.Admin.Commands;

public class ChangeUserRoleCommandValidator : AbstractValidator<ChangeUserRoleCommand>
{
    private static readonly string[] ValidRoles = { "Admin", "Staff", "Customer" };

    public ChangeUserRoleCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("ID người dùng không được để trống.");

        RuleFor(x => x.NewRole)
            .NotEmpty().WithMessage("Vai trò mới không được để trống.")
            .Must(r => ValidRoles.Contains(r?.Trim(), StringComparer.OrdinalIgnoreCase))
            .WithMessage("Vai trò không hợp lệ. Chỉ chấp nhận Admin, Staff, Customer.");
    }
}

