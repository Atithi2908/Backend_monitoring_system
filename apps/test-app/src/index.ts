import express, { Request, Response } from "express";
import {
  monitorMiddleware,
  startSystemMetrics
} from "monitoring-sdk";

const app = express();
startSystemMetrics(
  {
    serviceName: "test-service",
    collectorUrl: "http://localhost:4000/collect",
    apiKey: "abc123"
  },
  5000 
);

app.use(
  monitorMiddleware({
    serviceName: "test-service",
    collectorUrl: "http://localhost:4000/collect",
    apiKey: "abc123"
  })
);

app.get("/ping", (req: Request, res: Response) => {
  res.json({ message: "pong" });
});

app.get("/slow", async (req: Request, res: Response) => {
  await new Promise(r => setTimeout(r, 800));
  res.send("slow response");
});

app.listen(3001, () => {
  console.log("Test app running on port 3001");
});
