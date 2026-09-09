using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Events.Queries;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Admin.Queries;

public record UserDto(
    Guid Id, 
    string Name, 
    string Email, 
    string Role, 
    bool IsBlocked, 
    DateTime CreatedAt,
    string Version
);

public record GetUsersQuery(
    string? Search = null,
    string? Role = null,
    bool? IsBlocked = null,
    int Page = 1, 
    int PageSize = 10
) : IRequest<PagedResult<UserDto>>;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, PagedResult<UserDto>>
{
    private readonly IApplicationDbContext _context;

    public GetUsersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var page = request.Page > 0 ? request.Page : 1;
        var pageSize = Math.Clamp(request.PageSize > 0 ? request.PageSize : 10, 1, 100);

        var query = _context.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            var pattern = $"%{search}%";
            query = query.Where(u => EF.Functions.Like(u.Name, pattern) || EF.Functions.Like(u.Email, pattern));
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            query = query.Where(u => u.Role == request.Role);
        }

        if (request.IsBlocked.HasValue)
        {
            query = query.Where(u => u.IsBlocked == request.IsBlocked.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new { u.Id, u.Name, u.Email, u.Role, u.IsBlocked, u.CreatedAt, u.Version })
            .ToListAsync(cancellationToken);

        var items = users.Select(u => new UserDto(
            u.Id, u.Name, u.Email, u.Role, u.IsBlocked, u.CreatedAt,
            Convert.ToBase64String(u.Version))).ToList();

        return new PagedResult<UserDto>(items, totalCount, page, pageSize);
    }
}
