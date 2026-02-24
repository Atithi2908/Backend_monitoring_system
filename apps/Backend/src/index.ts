import "dotenv/config";
import express from "express";
import { collectRouter } from "./routes/collect";
import { metricsDebugRouter } from "./routes/metricdebug";
import { startAggregationJob } from "./jobs/aggregation";
const app = express();
app.use(express.json());
app.use("/collect", collectRouter);
app.use("/", metricsDebugRouter);
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Collector running on port ${PORT}`);
  startAggregationJob();
});
