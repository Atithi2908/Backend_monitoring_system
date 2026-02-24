import cron from "node-cron";
import { runSystemAggregation } from "../services/aggregation/systemAggregator";
import { runRequestAggregation } from "../services/aggregation/requestAggregator";
import { runSystemHourAggregation } from "../services/aggregation/systemAggregatorHour";
import { runRequestHourAggregation } from "../services/aggregation/requestAggregatorHour";

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
  cron.schedule("0 * * * *", async () => {
    try {
      await runSystemHourAggregation();
      await runRequestHourAggregation();
    } catch (error) {
      console.error("Hour aggregation error:", error);
    }
  });
}