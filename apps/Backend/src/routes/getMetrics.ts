import { Router } from "express";
import { getRequestMetrics, getSystemMetrics } from "../controllers/getMetrics";

export const metricsRouter:Router = Router();
metricsRouter.get("/request", getRequestMetrics);
metricsRouter.get("/system", getSystemMetrics);