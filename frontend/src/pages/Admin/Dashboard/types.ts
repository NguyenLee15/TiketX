export interface DailyRevenue {
  date: string;
  revenue: number;
  ticketsSold: number;
}

export interface TopEvent {
  id: string;
  title: string;
  category: string;
  ticketsSold: number;
  revenue: number;
  totalSeats: number;
}

export interface RecentTransaction {
  ticketId: string;
  orderCode: number;
  eventTitle: string;
  userName: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface Stats {
  totalUsers: number;
  totalEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  totalRefunded: number;
  totalRefundPending?: number;
  totalNetRevenue?: number;
  totalCheckedIn: number;
  topEvents: TopEvent[];
  recentTransactions: RecentTransaction[];
  dailyStats: DailyRevenue[];
}

