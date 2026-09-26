using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Tickets.Queries;

public class GetMyTicketsQueryHandler : IRequestHandler<GetMyTicketsQuery, TicketPage>
{
    private readonly ICustomerTicketReadModel _readModel;
    public GetMyTicketsQueryHandler(ICustomerTicketReadModel readModel)
    {
        _readModel = readModel;
    }

    public Task<TicketPage> Handle(GetMyTicketsQuery request, CancellationToken cancellationToken) =>
        _readModel.GetForUserAsync(request.UserId, request.Page, request.PageSize, request.Status, cancellationToken);
}
