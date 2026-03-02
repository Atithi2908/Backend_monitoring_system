import { Response } from "express";
import { prisma } from "../config/database";
import { AuthRequest } from "../middleware/jwtAuth";

const ALERT_OPERATORS = [">", ">=", "<", "<=", "==", "!="] as const;

async function resolveEffectiveUserId(req: AuthRequest): Promise<string | null> {
  const userIdFromToken = req.userId;
  const userEmailFromToken = req.userEmail;

  if (userIdFromToken) {
    const userById = await prisma.user.findUnique({
      where: { id: userIdFromToken },
      select: { id: true },
    });

    if (userById) {
      return userById.id;
    }
  }

  if (userEmailFromToken) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: userEmailFromToken },
      select: { id: true },
    });

    if (userByEmail) {
      return userByEmail.id;
    }
  }

  return null;
}

export async function createAlertRule(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveEffectiveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      projectId,
      serviceName,
      metricType,
      metricField,
      operator,
      threshold,
      windowSec,
      endpoint,
      webhookUrl,
      isActive,
    } = req.body;

    if (
      !projectId ||
      !serviceName ||
      !metricType ||
      !metricField ||
      !operator ||
      threshold === undefined ||
      windowSec === undefined
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!ALERT_OPERATORS.includes(operator)) {
      return res.status(400).json({ error: "Invalid operator" });
    }

    const numericThreshold = Number(threshold);
    const numericWindowSec = Number(windowSec);

    if (!Number.isFinite(numericThreshold)) {
      return res.status(400).json({ error: "Invalid threshold" });
    }

    if (!Number.isInteger(numericWindowSec) || numericWindowSec <= 0) {
      return res.status(400).json({ error: "windowSec must be a positive integer" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const alertRule = await prisma.alertRule.create({
      data: {
        projectId,
        serviceName,
        metricType,
        metricField,
        operator,
        threshold: numericThreshold,
        windowSec: numericWindowSec,
        endpoint: typeof endpoint === "string" ? endpoint : null,
        ...(typeof webhookUrl === "string" ? { webhookUrl } : {}),
        isActive: isActive === undefined ? true : Boolean(isActive),
      },
    });

    return res.status(201).json({
      message: "Alert rule created successfully",
      alertRule,
    });
  } catch (error) {
    console.error("Create alert rule error:", error);
    return res.status(500).json({ error: "Failed to create alert rule" });
  }
}
