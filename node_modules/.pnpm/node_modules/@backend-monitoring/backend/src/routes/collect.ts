import { Router, Request, Response } from "express";
import { apiKeyAuth } from "../middleware/apiKeyAuth";
import { isValidMetric } from "../utils/validate";
import { metricsStore } from "../storage/metric.store";

export const collectRouter: Router = Router();

collectRouter.post(
  "/",
  apiKeyAuth,
  (req: Request, res: Response) => {
    const metric = req.body;

    if (!isValidMetric(metric)) {
      return res.status(400).json({ error: "Invalid metric payload" });
    }

    const projectId = (req as any).projectId;

    metricsStore.push({
      projectId,
      receivedAt: Date.now(),
      metric
    });

    
    console.log("Metric ingested:", {
      projectId,
      type: metric.type,
      service: metric.serviceName
    });

    res.status(200).json({ status: "ok" });
  }
);
