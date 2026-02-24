import { Router } from "express";
import { apiKeyAuth } from "../middleware/apiKeyAuth";
import { collectMetric } from "../controllers/collect.controller";

export const collectRouter: Router = Router();

collectRouter.post("/", apiKeyAuth, collectMetric);
