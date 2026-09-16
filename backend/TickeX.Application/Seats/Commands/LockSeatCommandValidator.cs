using FluentValidation;

namespace TickeX.Application.Seats.Commands;

public class LockSeatCommandValidator : AbstractValidator<LockSeatCommand>
{
    public LockSeatCommandValidator()
    {
        RuleFor(x => x.EventId).NotEmpty();
        RuleFor(x => x.SeatId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Version)
            .NotNull().WithMessage("Version is required.")
            .Must(v => v != null && v.Length == 16).WithMessage("Version must be a 16-byte concurrency token.");
    }
}
