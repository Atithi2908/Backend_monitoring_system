import { Request, Response, NextFunction } from "express";
import { apiKeyToProjectMap } from "../storage/apiKeys.store";

export function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.header("x-api-key");

  if (!apiKey) {
    return res.status(401).json({ error: "API key missing" });
  }

  const projectId = apiKeyToProjectMap.get(apiKey);

  if (!projectId) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  // Attach projectId to request (backend-owned data)
  (req as any).projectId = projectId;

  next();
}
