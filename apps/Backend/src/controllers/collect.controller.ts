import { Request, Response } from "express";
import { isValidMetric } from "../utils/validate";
import { prisma } from "../config/database";

import { MetricType } from "shared-types";

export const collectMetric = async (req: Request, res: Response) => {
  try {
    const metric = req.body;

    if (!isValidMetric(metric)) {
      return res.status(400).json({ error: "Invalid metric payload" });
    }

    const projectId = (req as any).projectId;

    
    await prisma.service.upsert({
      where: {
        projectId_name: {
          projectId: projectId,
          name: metric.serviceName,
        },
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: metric.serviceName,
        projectId: projectId,
      },
    });

    if (metric.type === MetricType.REQUEST) {
      await prisma.requestMetric.create({
        data: {
          projectId,
          serviceName: metric.serviceName,
          timestamp: metric.timestamp,
          method: metric.method,
          route: metric.route,
          statusCode: metric.statusCode,
          latencyMs: metric.latencyMs,
          isError: metric.isError
        }
      });
    } else if (metric.type === MetricType.SYSTEM) {
      await prisma.systemMetric.create({
        data: {
          projectId,
          serviceName: metric.serviceName,
          timestamp: metric.timestamp,
          cpuUsagePercent: metric.cpuUsagePercent,
          memoryUsageMb: metric.memoryUsageMb
        }
      });
    } else {
      return res.status(400).json({ error: "Unknown metric type" });
    }

    console.log("Metric ingested:", {
      projectId,
      type: metric.type,
      service: metric.serviceName
    });

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Error saving metric:", error);
    res.status(500).json({ error: "Failed to save metric" });
  }
};
