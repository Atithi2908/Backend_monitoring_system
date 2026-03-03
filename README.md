# Backend Monitor

Backend Monitor helps you collect backend request/system metrics and visualize them in a dashboard.

## SDK package

Install the published SDK package:

```bash
npm install backend-monitoring-sdk
```

or

```bash
pnpm add backend-monitoring-sdk
```

## Step-by-step setup (Express)

### 1) Sign up / sign in

Use the dashboard authentication flow, or call:

```http
POST /auth/signup
POST /auth/signin
```

Save the JWT token from response.

### 2) Create a project and get your first API key

Create a project (this returns a primary API key):

```http
POST /create/project
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "orders-service",
  "description": "Orders backend",
  "region": "US-EAST-1",
  "status": "ACTIVE"
}
```

You can also rotate/create a new active key later:

```http
POST /create/apikey/:projectId
Authorization: Bearer <JWT_TOKEN>
```

### 3) Add SDK in your Express app

Use these imports and wire middleware + system metrics.

```ts
import express from "express";
import { monitorMiddleware, startSystemMetrics } from "backend-monitoring-sdk";

const app = express();

const monitorConfig = {
  serviceName: "orders-service",
  collectorUrl: "http://localhost:4000/collect",
  apiKey: process.env.BM_API_KEY || "",
};

app.use(monitorMiddleware(monitorConfig));
startSystemMetrics(monitorConfig, 10000);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(3000, () => {
  console.log("Orders service running on 3000");
});
```

### 4) Set API key in environment

```bash
BM_API_KEY=<your_project_api_key>
```

This key is sent by SDK to:

```http
POST /collect
x-api-key: <BM_API_KEY>
```

### 5) Generate traffic

Hit your Express routes (or run your test app/load script) so request + system metrics are emitted.

### 6) Monitor metrics on dashboard

1. Open dashboard UI.
2. Log in.
3. Open **Home** and select your project.
4. View project and service metrics (latency, request counts, error rate, CPU, memory).
5. Use status/alert sections to monitor system health.

## API quick reference

### Auth
- `POST /auth/signup`
- `POST /auth/signin`
- `GET /auth/me`

### Project + setup
- `POST /create/project` (returns primary API key)
- `POST /create/apikey/:projectId`
- `POST /create/service`
- `GET /projects`
- `GET /projects/:projectId`
- `GET /projects/:projectId/services`
- `PATCH /projects/:projectId/status`
- `PATCH /projects/:projectId/slack-webhook`
- `DELETE /projects/:projectId`

### Metrics collection
- `POST /collect` (requires `x-api-key`)

## Pricing

### Starter — Free
- Up to 2 services
- Basic request + system metrics
- Community support

### Growth — $19/month
- Up to 20 services
- Alerts + longer retention
- Email support

### Scale — Custom
- Unlimited services
- Advanced alerting and integrations
- Priority support

> Pricing tiers are examples for this deployment. Update values as needed for your business plan.
