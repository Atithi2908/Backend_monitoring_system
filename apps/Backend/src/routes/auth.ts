import { Router } from "express";
import { signup, signin, getMe } from "../controllers/auth";
import { authenticateToken } from "../middleware/jwtAuth";

const authRouter: Router = Router();

authRouter.post("/signup", signup);
authRouter.post("/signin", signin);
authRouter.get("/me", authenticateToken, getMe);

export default authRouter;
