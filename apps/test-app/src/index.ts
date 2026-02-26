import express, { Request, Response, NextFunction } from "express";
import { monitorMiddleware, startSystemMetrics } from "monitoring-sdk";
import dotenv from "dotenv";


dotenv.config();

const PORT = process.env.PORT || "3001";
const MONITORING_URL = process.env.MONITORING_URL || "http://localhost:3000/collect";
const MONITORING_API_KEY = process.env.MONITORING_API_KEY || "";
const SERVICE_NAME = process.env.SERVICE_NAME || "test-app";

if (!MONITORING_API_KEY) {
  console.error("Error: MONITORING_API_KEY is required");
  process.exit(1);
}

const app = express();

startSystemMetrics(
  {
    serviceName: SERVICE_NAME,
    collectorUrl: MONITORING_URL,
    apiKey: MONITORING_API_KEY,
  },
  5000
);


const middleware = monitorMiddleware({
  serviceName: SERVICE_NAME,
  collectorUrl: MONITORING_URL,
  apiKey: MONITORING_API_KEY,
});
app.use((req: Request, res: Response, next: NextFunction) => middleware(req, res, next));


app.get("/ping", (req: Request, res: Response) => {
  res.json({ message: "pong" });
});

app.get("/slow", async (req: Request, res: Response) => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  res.send("slow response");
});

app.get("/error", (req: Request, res: Response) => {
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(Number(PORT), () => {
  console.log(`✓ Test app running on port ${PORT}`);
  console.log(`✓ Service: ${SERVICE_NAME}`);
  console.log(`✓ Monitoring URL: ${MONITORING_URL}`);
  console.log(`✓ System metrics collecting every 5s`);
});
