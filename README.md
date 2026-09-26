# TickeX - Hệ thống Đặt Vé & Giữ Chỗ Sự Kiện Thời Gian Thực

Hệ thống đặt vé sự kiện hiệu năng cao xây dựng theo kiến trúc Clean Architecture, kết hợp kiểm soát đồng thời đa tầng (Redis Distributed Lock & EF Core Optimistic Concurrency), xử lý sự kiện bất đồng bộ qua RabbitMQ / Outbox Pattern, chữ ký số bảo mật HMAC-SHA256, thông báo real-time qua SignalR và lập lịch nền với Hangfire.

---

## Kiến Trúc Hệ Thống (Architecture Overview)

- **Backend:** .NET 8 Web API
  - `TickeX.Domain`: Core Entities, Enums, Value Objects, Domain Invariants.
  - `TickeX.Application`: CQRS với MediatR, FluentValidation, Ports & Interfaces.
  - `TickeX.Infrastructure`: SQL Server (EF Core), Redis (Distributed Lock & Caching), RabbitMQ (MassTransit / Consumer), Hangfire (Scheduler), SignalR (Hubs), PayOS SDK.
  - `TickeX.WebApi`: REST Controllers, Health Checks, Middlewares, Rate Limiting, Cookie Authentication.
- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS + Zustand + TanStack Query + SignalR + Zod.

---

## Hướng Dẫn Khởi Chạy (Getting Started)

### 1. Khởi chạy toàn bộ hệ thống bằng Docker Compose (Khuyến nghị)
Hệ thống tích hợp quy trình bootstrap CSDL và chạy migration tự động qua container `db-migrator`:

```bash
# 1. Sao chép cấu hình mẫu
cp .env.example .env

# 2. Khởi chạy toàn bộ các dịch vụ (SQL Server, Redis, RabbitMQ, Migration, Backend, Frontend)
docker compose --env-file .env up -d --build
```

**Các cổng dịch vụ truy cập:**
- **Frontend Web UI:** [http://localhost:3000](http://localhost:3000)
- **Health Check Readiness:** [http://localhost:3000/health/ready](http://localhost:3000/health/ready) (Proxy qua Nginx)
- **Backend API (Nội bộ):** `http://backend:8080`
- **RabbitMQ Management:** [http://localhost:15672](http://localhost:15672) (Tài khoản từ file `.env`)

---

### 2. Khởi chạy thủ công môi trường Development

#### Backend (.NET 8):
```bash
cd backend
dotnet restore
dotnet run --project TickeX.WebApi
```

#### Frontend (React / Vite):
```bash
cd frontend
npm install
npm run dev
```

---

## Kiểm Thử & Kiểm Toán Chất Lượng (Quality Assurance)

```bash
# Chạy toàn bộ Unit & Integration Tests của Backend
dotnet test backend/TickeX.sln

# Chạy toàn bộ Component & Unit Tests của Frontend
cd frontend
npm test

# Kiểm tra bản dựng Production
npm run build
```
