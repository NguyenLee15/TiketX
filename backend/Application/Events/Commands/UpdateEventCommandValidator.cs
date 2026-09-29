using FluentValidation;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Events.Commands;

public class UpdateEventCommandValidator : AbstractValidator<UpdateEventCommand>
{
    public UpdateEventCommandValidator(ITimePolicy? time = null)
    {
        var now = (time ?? new UtcTimePolicy()).UtcNow;
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("ID sự kiện không được để trống.");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Tiêu đề sự kiện không được để trống.")
            .MaximumLength(250).WithMessage("Tiêu đề sự kiện không được vượt quá 250 ký tự.");

        RuleFor(x => x.Description)
            .MaximumLength(3000).WithMessage("Mô tả không được vượt quá 3000 ký tự.");

        RuleFor(x => x.Location)
            .NotEmpty().WithMessage("Địa điểm tổ chức không được để trống.")
            .MaximumLength(250).WithMessage("Địa điểm không được vượt quá 250 ký tự.");

        RuleFor(x => x.Date)
            .GreaterThan(now).WithMessage("Thời gian bắt đầu phải ở tương lai.");

        RuleFor(x => x.EndDate)
            .GreaterThan(x => x.Date).WithMessage("Thời gian kết thúc phải sau thời gian bắt đầu.");

        RuleFor(x => x.BasePrice)
            .GreaterThan(0).WithMessage("Giá vé cơ sở phải lớn hơn 0.");

        RuleFor(x => x.RefundCutoffHours)
            .InclusiveBetween(0, 720).WithMessage("Thời hạn hủy vé phải từ 0 đến 720 giờ.");

        RuleFor(x => x.ImageUrl)
            .Must(BeHttpUrl)
            .When(x => !string.IsNullOrWhiteSpace(x.ImageUrl))
            .WithMessage("ImageUrl không hợp lệ.");

        RuleFor(x => x.BannerUrl)
            .Must(BeHttpUrl)
            .When(x => !string.IsNullOrWhiteSpace(x.BannerUrl))
            .WithMessage("BannerUrl không hợp lệ.");
    }

    private static bool BeHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}
