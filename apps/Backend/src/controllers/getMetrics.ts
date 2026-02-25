import { Request, Response } from "express";
import { prisma } from "../config/database";

const ONE_HOUR = 60 * 60 * 1000;
const TWO_DAYS = 48 * ONE_HOUR;

export async function getRequestMetrics(req: Request, res: Response) {
  try {
    const { projectId, serviceName, from, to } = req.query;

    if (!projectId || !serviceName || !from || !to) {
      return res.status(400).json({ error: "Missing required query params" });
    }

    const range = Number(to) - Number(from);

    let data;
    if (range <= ONE_HOUR) {
      data = await prisma.requestMetricAggregate.findMany({
        where: {
          projectId: String(projectId),
          serviceName: String(serviceName),
          minuteBucket: {
            gte: BigInt(from as string),
            lte: BigInt(to as string),
          },
        },
        orderBy: { minuteBucket: "asc" },
      });
    } else if (range <= TWO_DAYS) {
      data = await prisma.requestMetricAggregateHour.findMany({
        where: {
          projectId: String(projectId),
          serviceName: String(serviceName),
          hourBucket: {
            gte: BigInt(from as string),
            lte: BigInt(to as string),
          },
        },
        orderBy: { hourBucket: "asc" },
      });
    } else {
      data = await prisma.requestMetricAggregateDay.findMany({
        where: {
          projectId: String(projectId),
          serviceName: String(serviceName),
          dayBucket: {
            gte: BigInt(from as string),
            lte: BigInt(to as string),
          },
        },
        orderBy: { dayBucket: "asc" },
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Request metrics error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getSystemMetrics(req: Request, res: Response) {
  try {
    const { projectId, serviceName, from, to } = req.query;

    if (!projectId || !serviceName || !from || !to) {
      return res.status(400).json({
        error: "projectId, serviceName, from, to are required",
      });
    }

    const fromTs = BigInt(from as string);
    const toTs = BigInt(to as string);

    const range = Number(to) - Number(from);

    let rawData;

    // 🔥 Resolution switching
    if (range <= ONE_HOUR) {
      rawData = await prisma.systemMetricAggregate.findMany({
        where: {
          projectId: String(projectId),
          serviceName: String(serviceName),
          minuteBucket: {
            gte: fromTs,
            lte: toTs,
          },
        },
        orderBy: { minuteBucket: "asc" },
      });

      return res.json(
        rawData.map((row) => ({
          bucket: row.minuteBucket,
          avgCpu: row.avgCpu,
          maxCpu: row.maxCpu,
          avgMemoryMb: row.avgMemoryMb,
          maxMemoryMb: row.maxMemoryMb,
        }))
      );
    }

    if (range <= TWO_DAYS) {
      rawData = await prisma.systemMetricAggregateHour.findMany({
        where: {
          projectId: String(projectId),
          serviceName: String(serviceName),
          hourBucket: {
            gte: fromTs,
            lte: toTs,
          },
        },
        orderBy: { hourBucket: "asc" },
      });

      return res.json(
        rawData.map((row) => ({
          bucket: row.hourBucket,
          avgCpu: row.avgCpu,
          maxCpu: row.maxCpu,
          avgMemoryMb: row.avgMemoryMb,
          maxMemoryMb: row.maxMemoryMb,
        }))
      );
    }

    // 🔥 Long range → day table
    rawData = await prisma.systemMetricAggregateDay.findMany({
      where: {
        projectId: String(projectId),
        serviceName: String(serviceName),
        dayBucket: {
          gte: fromTs,
          lte: toTs,
        },
      },
      orderBy: { dayBucket: "asc" },
    });

    return res.json(
      rawData.map((row) => ({
        bucket: row.dayBucket,
        avgCpu: row.avgCpu,
        maxCpu: row.maxCpu,
        avgMemoryMb: row.avgMemoryMb,
        maxMemoryMb: row.maxMemoryMb,
      }))
    );
  } catch (error) {
    console.error("System metrics error:", error);
    return res.status(500).json({
      error: "Failed to fetch system metrics",
    });
  }
}