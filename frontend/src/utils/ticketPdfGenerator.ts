import jsPDF from 'jspdf';
import { toast } from 'react-hot-toast';

export interface TicketPdfData {
  id: string;
  orderCode: number;
  eventTitle: string;
  eventDate: string;
  location: string;
  venueName?: string;
  row: string;
  number: number;
  tier: number;
  price: number;
  status: string;
}

export const getQrImageDataUrl = (ticketId: string): Promise<string> => {
  return new Promise((resolve) => {
    const svgEl = document.getElementById(`qr-svg-${ticketId}`);
    if (!svgEl) {
      resolve('');
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 0, 0, 400, 400);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve('');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
};

export async function generateTicketPdf(ticket: TicketPdfData): Promise<void> {
  try {
    toast.loading('Đang xuất vé PDF vector độ nét cao...', { id: 'pdf-toast' });

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [210, 85]
    });

    // Background Card
    doc.setFillColor(15, 17, 23);
    doc.roundedRect(5, 5, 200, 75, 4, 4, 'F');

    // Left Accent Bar
    doc.setFillColor(99, 102, 241);
    doc.rect(5, 5, 4, 75, 'F');

    // Header Branding
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TICKEX ENTERTAINMENT', 15, 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text('OFFICIAL E-TICKET / VE DIEN TU', 15, 20);

    // Event Title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const displayTitle = ticket.eventTitle.length > 36 ? ticket.eventTitle.substring(0, 33) + '...' : ticket.eventTitle;
    doc.text(displayTitle, 15, 28);

    // Event Date & Location
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(209, 213, 219);
    const dateStr = new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ticket.eventDate));
    doc.text(`Thoi gian: ${dateStr}`, 15, 35);

    const locationStr = (ticket.venueName || ticket.location).length > 45 
      ? (ticket.venueName || ticket.location).substring(0, 42) + '...' 
      : (ticket.venueName || ticket.location);
    doc.text(`Dia diem: ${locationStr}`, 15, 41);

    // Seat Details Card
    doc.setFillColor(24, 28, 40);
    doc.roundedRect(15, 45, 125, 20, 2, 2, 'F');
    doc.setDrawColor(45, 55, 72);
    doc.roundedRect(15, 45, 125, 20, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text('HANG (ROW)', 20, 51);
    doc.text('GHE (SEAT)', 45, 51);
    doc.text('HANG VE (TIER)', 72, 51);
    doc.text('GIA VE (PRICE)', 105, 51);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(ticket.row, 20, 59);
    doc.text(ticket.number.toString(), 45, 59);

    const tierName = ticket.tier === 1 ? 'VIP' : ticket.tier === 2 ? 'ECONOMY' : 'STANDARD';
    if (ticket.tier === 1) doc.setTextColor(245, 158, 11);
    else if (ticket.tier === 2) doc.setTextColor(16, 185, 129);
    else doc.setTextColor(255, 255, 255);
    doc.text(tierName, 72, 59);

    doc.setTextColor(52, 211, 153);
    doc.text(`${new Intl.NumberFormat('vi-VN').format(ticket.price)} VND`, 105, 59);

    // Footer Meta
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Don hang: #${ticket.orderCode}  |  Ma ve: ${ticket.id.substring(0, 18)}...`, 15, 72);

    // Perforated Divider Line
    doc.setDrawColor(75, 85, 99);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(148, 8, 148, 77);
    doc.setLineDashPattern([], 0);

    // Right Stub: QR Code
    const qrDataUrl = await getQrImageDataUrl(ticket.id);
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 155, 10, 42, 42);
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('MA SOAT VE', 176, 58, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(`CODE: #${ticket.orderCode}`, 176, 63, { align: 'center' });

    const statusText = ticket.status.toLowerCase();
    if (statusText === 'paid') {
      doc.setTextColor(52, 211, 153);
      doc.text('HOP LE (PAID)', 176, 69, { align: 'center' });
    } else {
      doc.setTextColor(156, 163, 175);
      const statusLabels: Record<string, string> = {
        pending: 'CHO THANH TOAN',
        used: 'DA QUA CUA',
        refundpending: 'DANG HOAN TIEN',
        cancelled: 'DA HUY',
      };
      doc.text(statusLabels[statusText] || 'KHONG XAC DINH', 176, 69, { align: 'center' });
    }

    doc.save(`TickeX_Ticket_${ticket.orderCode}_${ticket.row}${ticket.number}.pdf`);
    toast.success('Đã tải xuống vé PDF vector thành công!', { id: 'pdf-toast' });
  } catch {
    toast.error('Lỗi khi tạo file PDF', { id: 'pdf-toast' });
  }
}
