using FluentValidation;

namespace TickeX.Application.Events.Commands;

public class CancelEventCommandValidator : AbstractValidator<CancelEventCommand>
{
    public CancelEventCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("ID sự kiện không được để trống.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Lý do hủy sự kiện không được để trống.")
            .MinimumLength(5).WithMessage("Lý do hủy sự kiện phải có ít nhất 5 ký tự.")
            .MaximumLength(500).WithMessage("Lý do hủy không được vượt quá 500 ký tự.");
    }
}
