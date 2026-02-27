import "dotenv/config";
import express from "express";
import cors from "cors";
import { collectRouter } from "./routes/collect";
import { metricsDebugRouter } from "./routes/metricdebug";
import { startAggregationJob } from "./jobs/aggregation";
import { metricsRouter } from "./routes/getMetrics";
import setupRouter from "./routes/setup";
import authRouter from "./routes/auth";
import projectRouter from "./routes/project";

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your production domain here
  credentials: true,
}));

app.use(express.json());

app.use("/auth", authRouter);
app.use("/projects", projectRouter);
app.use("/collect", collectRouter);
app.use("/", metricsDebugRouter);
app.use("/metrics", metricsRouter);
app.use("/create", setupRouter);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Collector running on port ${PORT}`);
  startAggregationJob();
});
