import { Router } from "express";
import { createAlertRule } from "../controllers/alert";
import { authenticateToken } from "../middleware/jwtAuth";

const alertRouter: Router = Router();

alertRouter.post("/", authenticateToken, createAlertRule);

export default alertRouter;
