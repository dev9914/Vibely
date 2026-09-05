import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { getExplore } from "../controllers/explore.controller.js";

const router = Router();

router.use(verifyJWT);
router.get("/", getExplore);

export default router;
