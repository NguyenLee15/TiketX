using FluentValidation;

namespace TickeX.Application.Users.Commands;

public class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty().WithMessage("UserId is required.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Tên không được để trống.").MaximumLength(100);
        RuleFor(x => x.Phone)
            .MaximumLength(20)
            .Matches(@"^(\+84|0)[35789]\d{8}$")
            .When(x => !string.IsNullOrWhiteSpace(x.Phone))
            .WithMessage("Số điện thoại không đúng định dạng.");
        RuleFor(x => x.AvatarUrl)
            .MaximumLength(500)
            .Must(uri => Uri.TryCreate(uri, UriKind.Absolute, out var parsed) &&
                         (parsed.Scheme == Uri.UriSchemeHttp || parsed.Scheme == Uri.UriSchemeHttps))
            .When(x => !string.IsNullOrWhiteSpace(x.AvatarUrl))
            .WithMessage("Đường dẫn ảnh đại diện không hợp lệ.");
    }
}

