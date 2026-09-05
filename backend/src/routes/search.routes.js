import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  searchHashtags,
  searchPosts,
  searchUsers,
} from "../controllers/explore.controller.js";

const router = Router();

router.use(verifyJWT);
router.get("/users", searchUsers);
router.get("/posts", searchPosts);
router.get("/hashtags", searchHashtags);

export default router;
