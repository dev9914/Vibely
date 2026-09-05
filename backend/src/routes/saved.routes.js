import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  savePost,
  unsavePost,
  getMySavedPosts,
} from "../controllers/saved.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getMySavedPosts);
router.route("/:postId").post(savePost).delete(unsavePost);

export default router;
