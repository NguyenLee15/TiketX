using TickeX.Domain.Enums;

namespace TickeX.Domain.Entities;

public class Event : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DateTime Date { get; private set; }
    public DateTime EndDate { get; private set; }
    public string Location { get; private set; } = string.Empty;
    public string VenueName { get; private set; } = string.Empty;
    public int TotalSeats { get; private set; }
    public string ImageUrl { get; private set; } = string.Empty;
    public string BannerUrl { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public string OrganizerName { get; private set; } = string.Empty;
    public decimal BasePrice { get; private set; }
    public EventStatus Status { get; private set; } = EventStatus.Published;
    public int RefundCutoffHours { get; private set; } = 24;
    public bool IsDeleted { get; private set; } = false;
    
    private readonly List<Seat> _seats = new();
    public IReadOnlyCollection<Seat> Seats => _seats.AsReadOnly();

    private Event() { } // For EF Core

    public Event(
        string title, 
        string description, 
        DateTime date, 
        DateTime endDate,
        string location, 
        string venueName,
        int totalSeats, 
        string category = "Concert", 
        string imageUrl = "",
        string bannerUrl = "",
        string organizerName = "TickeX Live",
        decimal basePrice = 200000m,
        int refundCutoffHours = 24)
    {
        Title = title;
        Description = description;
        Date = date;
        EndDate = endDate;
        Location = location;
        VenueName = venueName;
        TotalSeats = totalSeats;
        Category = category;
        ImageUrl = imageUrl;
        BannerUrl = string.IsNullOrEmpty(bannerUrl) ? imageUrl : bannerUrl;
        OrganizerName = organizerName;
        BasePrice = basePrice;
        Status = EventStatus.Published;
        RefundCutoffHours = refundCutoffHours;
    }

    public void Update(
        string title, 
        string description, 
        DateTime date, 
        DateTime endDate,
        string location, 
        string venueName,
        int totalSeats, 
        string category, 
        string imageUrl,
        string bannerUrl,
        string organizerName,
        decimal basePrice,
        EventStatus status,
        int refundCutoffHours)
    {
        Title = title;
        Description = description;
        Date = date;
        EndDate = endDate;
        Location = location;
        VenueName = venueName;
        TotalSeats = totalSeats;
        Category = category;
        ImageUrl = imageUrl;
        BannerUrl = bannerUrl;
        OrganizerName = organizerName;
        BasePrice = basePrice;
        Status = status;
        RefundCutoffHours = refundCutoffHours;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SoftDelete()
    {
        IsDeleted = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status = EventStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }

    public static string GetRowLetter(int index)
    {
        string letter = "";
        while (index >= 0)
        {
            letter = (char)('A' + (index % 26)) + letter;
            index = (index / 26) - 1;
        }
        return letter;
    }

    public void GenerateSeatsMatrix(int rowCount = 5, int seatsPerRow = 12)
    {
        _seats.Clear();
        
        for (int r = 0; r < rowCount; r++)
        {
            string rowLetter = GetRowLetter(r);
            SeatTier tier = r < 2 ? SeatTier.VIP : (r < 4 ? SeatTier.Standard : SeatTier.Economy);
            decimal multiplier = tier == SeatTier.VIP ? 1.75m : (tier == SeatTier.Standard ? 1.0m : 0.75m);
            decimal seatPrice = Math.Round(BasePrice * multiplier, 0);

            for (int s = 1; s <= seatsPerRow; s++)
            {
                _seats.Add(new Seat(Id, rowLetter, s, seatPrice, tier));
            }
        }
        TotalSeats = _seats.Count;
    }
}
