using FluentAssertions;
using TickeX.Application.Admin.Queries;
using TickeX.Application.Events.Queries;
using Xunit;

namespace TickeX.UnitTests.Admin;

public sealed class AdminQueryValidationTests
{
    [Fact]
    public void GetUsers_RejectsOversizedSearchAndPageSize()
    {
        var result = new GetUsersQueryValidator().Validate(new GetUsersQuery("x".PadRight(101, 'x'), null, false, 1, 51));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(x => x.PropertyName == nameof(GetUsersQuery.Search));
        result.Errors.Should().Contain(x => x.PropertyName == nameof(GetUsersQuery.PageSize));
    }

    [Fact]
    public void GetAdminEvents_RejectsOutOfRangePage()
    {
        var result = new GetAdminEventsQueryValidator().Validate(new GetAdminEventsQuery(Page: 0, PageSize: 50));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(x => x.PropertyName == nameof(GetAdminEventsQuery.Page));
    }

    [Fact]
    public void GetRefundRequests_RejectsPageSizeOver50()
    {
        var result = new GetRefundRequestsQueryValidator().Validate(new GetRefundRequestsQuery(1, 51));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(x => x.PropertyName == nameof(GetRefundRequestsQuery.PageSize));
    }
}
