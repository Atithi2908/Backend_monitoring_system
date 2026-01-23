import { RequestMetric, SystemMetric } from "shared-types";

export type StoredMetric =
  | {
      projectId: string;
      receivedAt: number;
      metric: RequestMetric;
    }
  | {
      projectId: string;
      receivedAt: number;
      metric: SystemMetric;
    };

export const metricsStore: StoredMetric[] = [];
