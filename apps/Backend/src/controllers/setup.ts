import { Request, Response } from "express";
import { prisma } from "../config/database";
import { generateApiKey } from "../utils/generateApiKey";
import { AuthRequest } from "../middleware/jwtAuth";

export async function createProject(req: AuthRequest, res: Response) {
  try {
    const { name } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const existing = await prisma.project.findFirst({
      where: { 
        name,
        userId 
      },
    });

    if (existing) {
      return res.status(400).json({ 
        error: "You already have a project with this name" 
      });
    }

    const apiKey = generateApiKey();
    const project = await prisma.project.create({
      data: { 
        name,
        id: crypto.randomUUID(),
        apiKey,
        userId,
      },
    });

    return res.json(project);
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ error: "Failed to create project" });
  }
}
export async function createApiKey(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Ensure user owns the project
    if (project.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const key = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        projectId,
      },
    });

    return res.json({
      message: "API key created successfully",
      apiKey: key,
    });
  } catch (error) {
    console.error("Create API key error:", error);
    return res.status(500).json({ error: "Failed to create API key" });
  }
}

export async function createService(req: AuthRequest, res: Response) {
  try {
    const { projectId, serviceName } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!projectId || !serviceName) {
      return res.status(400).json({ error: "projectId and serviceName are required" });
    } 

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    
    if (project.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const existing = await prisma.service.findFirst({
      where: {
        projectId,
        name: serviceName,
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Service already exists for this project" });
    }

    const service = await prisma.service.create({
      data: {
        id: crypto.randomUUID(),
        name: serviceName,
        projectId,
      },
    });

    return res.json({
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error);
    return res.status(500).json({ error: "Failed to create service" });
  }
}