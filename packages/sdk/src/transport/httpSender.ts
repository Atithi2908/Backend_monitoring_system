import type { BaseMetric } from "shared-types";
import type { SdkConfig } from "../config/sdkConfig";
export async function sendMetric(
  config: SdkConfig,
  metric: BaseMetric
): Promise<void> {
  try {
    await fetch(config.collectorUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey
      },
      body: JSON.stringify(metric)
    });
  } catch {
  }
}
