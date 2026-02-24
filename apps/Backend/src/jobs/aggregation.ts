import cron from "node-cron";
import { runSystemAggregation } from "../services/aggregation/systemAggregator";
import { runRequestAggregation } from "../services/aggregation/requestAggregator";

export function startAggregationJob() {
  console.log("Starting aggregation cron job...");

  // Runs every minute
  cron.schedule("* * * * *", async () => {
    console.log("Running minute aggregation...");

    try {
      await runSystemAggregation();
      await runRequestAggregation();
    } catch (error) {
      console.error("Aggregation error:", error);
    }
  });
}