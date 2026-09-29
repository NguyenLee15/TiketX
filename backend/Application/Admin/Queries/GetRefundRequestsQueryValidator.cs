using FluentValidation;

namespace TickeX.Application.Admin.Queries;

public sealed class GetRefundRequestsQueryValidator : AbstractValidator<GetRefundRequestsQuery>
{
    public GetRefundRequestsQueryValidator()
    {
        RuleFor(x => x.Page).InclusiveBetween(1, 10000);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}
