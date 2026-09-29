using System.Text;
using FluentValidation;
using TickeX.Application.Auth.Commands;

namespace TickeX.Application.Auth.Validators;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.")
            .MaximumLength(150).WithMessage("Email không được vượt quá 150 ký tự.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Mật khẩu không được để trống.")
            .Must(p => Encoding.UTF8.GetByteCount(p ?? string.Empty) <= 72)
            .WithMessage("Mật khẩu không được vượt quá 72 bytes.");
    }
}

