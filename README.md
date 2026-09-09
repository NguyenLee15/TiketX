# TickeX - Hệ thống Đặt Vé & Giữ Chỗ Sự Kiện Thời Gian Thực

Hệ thống đặt vé sự kiện hiệu năng cao với kiến trúc Clean Architecture, tối ưu chống bán trùng vé (optimistic concurrency & Redis lock), xử lý bất đồng bộ qua RabbitMQ, thông báo thời gian thực qua SignalR, và lập lịch với Hangfire.

## Cấu trúc thư mục

- `backend/`: ASP.NET Core 8 Web API (Clean Architecture: Domain, Application, Infrastructure, WebApi, MediatR, Redis, RabbitMQ, Hangfire, SignalR)
- `frontend/`: React 19 + TypeScript + Vite + TailwindCSS + Zustand + SignalR + QR Code Generator + jsPDF

## Chạy dự án

### 1. Backend (.NET 8)
```bash
cd backend
dotnet restore
dotnet run --project TickeX.WebApi
```

### 2. Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev
```

### 3. Chạy qua Docker Compose
```bash
docker compose up -d
```
- Backend API: http://localhost:5000/swagger
- Frontend UI: http://localhost:3000
- RabbitMQ Management: http://localhost:15672 (credentials from `.env`, never committed)
