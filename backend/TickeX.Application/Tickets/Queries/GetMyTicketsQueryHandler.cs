using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Tickets.Queries;

public class GetMyTicketsQueryHandler : IRequestHandler<GetMyTicketsQuery, List<TicketDto>>
{
    private readonly ICustomerTicketReadModel _readModel;
    public GetMyTicketsQueryHandler(ICustomerTicketReadModel readModel)
    {
        _readModel = readModel;
    }

    public async Task<List<TicketDto>> Handle(GetMyTicketsQuery request, CancellationToken cancellationToken)
    {
        return (await _readModel.GetForUserAsync(request.UserId, cancellationToken)).ToList();
    }
}
