import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import {
  createStory,
  deleteStory,
  getStoriesFeed,
  markStoryViewed,
  getUserStories,
} from "../controllers/story.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getStoriesFeed).post(
  upload.fields([
    { name: "image", maxCount: 10 },
    { name: "video", maxCount: 3 },
  ]),
  createStory,
);

router.route("/:storyId").delete(deleteStory);
router.route("/:storyId/view").put(markStoryViewed);

router.route("/user/:userId").get(getUserStories);

export default router;
