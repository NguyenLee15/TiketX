using FluentValidation;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Events.Commands;

public class CreateEventCommandValidator : AbstractValidator<CreateEventCommand>
{
    public CreateEventCommandValidator(ITimePolicy? time = null)
    {
        var now = (time ?? new UtcTimePolicy()).UtcNow;
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Tiêu đề sự kiện không được để trống.")
            .MaximumLength(250).WithMessage("Tiêu đề sự kiện không được vượt quá 250 ký tự.");

        RuleFor(x => x.Description)
            .MaximumLength(3000).WithMessage("Mô tả không được vượt quá 3000 ký tự.");

        RuleFor(x => x.Location)
            .NotEmpty().WithMessage("Địa điểm tổ chức không được để trống.")
            .MaximumLength(250).WithMessage("Địa điểm không được vượt quá 250 ký tự.");

        RuleFor(x => x.Date)
            .NotEmpty().WithMessage("Thời gian bắt đầu không được để trống.")
            .GreaterThan(now).WithMessage("Thời gian bắt đầu sự kiện phải ở tương lai.");

        RuleFor(x => x.EndDate)
            .Must((cmd, end) => end >= cmd.Date).WithMessage("Thời gian kết thúc phải diễn ra sau hoặc cùng thời điểm bắt đầu.");

        RuleFor(x => x.BasePrice)
            .GreaterThan(0).WithMessage("Giá vé cơ sở phải lớn hơn 0.");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Trạng thái sự kiện không hợp lệ.");

        RuleFor(x => x.RowCount)
            .InclusiveBetween(1, 100).WithMessage("Số lượng hàng ghế phải từ 1 đến 100.");

        RuleFor(x => x.SeatsPerRow)
            .InclusiveBetween(1, 100).WithMessage("Số lượng ghế mỗi hàng phải từ 1 đến 100.");

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
