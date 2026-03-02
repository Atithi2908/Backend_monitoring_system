import cron from "node-cron";
import { AlertRule } from "@prisma/client";
import { prisma } from "../config/database";

type NumericOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";
type SupportedMetricField = "avgLatencyMs" | "errorRate" | "avgCpu" | "avgMemoryMb";

function compareWithOperator(left: number, operator: string, right: number): boolean {
  const op = operator as NumericOperator;

  switch (op) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return false;
  }
}

function isSupportedMetricField(metricField: string): metricField is SupportedMetricField {
  return (
    metricField === "avgLatencyMs" ||
    metricField === "errorRate" ||
    metricField === "avgCpu" ||
    metricField === "avgMemoryMb"
  );
}

async function sendAlertWebhook(rule: AlertRule, message: string): Promise<void> {
  const webhookUrl = (rule as any).webhookUrl as string | undefined;

  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
      }),
    });
  } catch (error) {
    console.error("Failed to send alert webhook:", {
      alertRuleId: rule.id,
      webhookUrl,
      error,
    });
  }
}

async function computeMetricValue(rule: AlertRule, fromTs: bigint, toTs: bigint): Promise<number | null> {
  if (!isSupportedMetricField(rule.metricField)) {
    return null;
  }

  if (rule.metricField === "avgCpu" || rule.metricField === "avgMemoryMb") {
    const systemAggregate = await prisma.systemMetric.aggregate({
      where: {
        projectId: rule.projectId,
        serviceName: rule.serviceName,
        timestamp: {
          gte: fromTs,
          lt: toTs,
        },
      },
      _avg: {
        cpuUsagePercent: true,
        memoryUsageMb: true,
      },
    });

    if (rule.metricField === "avgCpu") {
      return systemAggregate._avg.cpuUsagePercent ?? null;
    }

    return systemAggregate._avg.memoryUsageMb ?? null;
  }

  const requestWhere = {
    projectId: rule.projectId,
    serviceName: rule.serviceName,
    ...(rule.endpoint ? { route: rule.endpoint } : {}),
    timestamp: {
      gte: fromTs,
      lt: toTs,
    },
  };

  if (rule.metricField === "avgLatencyMs") {
    const requestAggregate = await prisma.requestMetric.aggregate({
      where: requestWhere,
      _avg: {
        latencyMs: true,
      },
    });

    return requestAggregate._avg.latencyMs ?? null;
  }

  const totalAggregate = await prisma.requestMetric.aggregate({
    where: requestWhere,
    _count: {
      _all: true,
    },
  });

  const totalCount = totalAggregate._count._all;
  if (totalCount === 0) {
    return null;
  }

  const errorAggregate = await prisma.requestMetric.aggregate({
    where: {
      ...requestWhere,
      isError: true,
    },
    _count: {
      _all: true,
    },
  });

  return (errorAggregate._count._all / totalCount) * 100;
}

async function evaluateRule(rule: AlertRule): Promise<void> {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const fromTs = BigInt(now - windowMs);
  const toTs = BigInt(now);

  const computedValue = await computeMetricValue(rule, fromTs, toTs);
  const shouldTrigger =
    computedValue !== null && Number.isFinite(computedValue)
      ? compareWithOperator(computedValue, rule.operator, rule.threshold)
      : false;

  if (shouldTrigger) {
    const whereCondition = {
      id: rule.id,
      ...( { triggered: false } as Record<string, boolean> ),
    };
    const dataUpdate = {
      ...( { triggered: true } as Record<string, boolean> ),
    };

    const updateResult = await prisma.alertRule.updateMany({
      where: whereCondition as any,
      data: dataUpdate as any,
    });

    if (updateResult.count > 0) {
      const message = `🚨 ${rule.metricField} threshold breached on ${rule.serviceName} (${computedValue?.toFixed(2)})`;

      console.log("Alert trigger found:", {
        alertRuleId: rule.id,
        projectId: rule.projectId,
        serviceName: rule.serviceName,
        metricType: rule.metricType,
        metricField: rule.metricField,
        operator: rule.operator,
        threshold: rule.threshold,
        windowSec: rule.windowSec,
        endpoint: rule.endpoint,
        computedValue,
      });

      await sendAlertWebhook(rule, message);
    }
    return;
  }

  if (!shouldTrigger) {
    const whereCondition = {
      id: rule.id,
      ...( { triggered: true } as Record<string, boolean> ),
    };
    const dataUpdate = {
      ...( { triggered: false } as Record<string, boolean> ),
    };

    const updateResult = await prisma.alertRule.updateMany({
      where: whereCondition as any,
      data: dataUpdate as any,
    });

    if (updateResult.count > 0) {
      const valueText = computedValue === null ? "n/a" : computedValue.toFixed(2);
      const message = `✅ Alert resolved on ${rule.serviceName} for ${rule.metricField} (${valueText})`;

      console.log("Alert resolved:", {
        alertRuleId: rule.id,
        projectId: rule.projectId,
        serviceName: rule.serviceName,
        metricType: rule.metricType,
        metricField: rule.metricField,
        operator: rule.operator,
        threshold: rule.threshold,
        windowSec: rule.windowSec,
        endpoint: rule.endpoint,
        computedValue,
      });

      await sendAlertWebhook(rule, message);
    }
  }
}

export function startAlertEvaluationJob() {
  let isRunning = false;

  cron.schedule("* * * * *", async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const rules = await prisma.alertRule.findMany({
        where: {
          isActive: true,
          metricField: {
            in: ["avgLatencyMs", "errorRate", "avgCpu", "avgMemoryMb"],
          },
        },
      });

      for (const rule of rules) {
        await evaluateRule(rule);
      }
    } catch (error) {
      console.error("Alert evaluation job error:", error);
    } finally {
      isRunning = false;
    }
  });
}
