import { Router } from "express";
import { addComment, addLike, checkIfLiked, createPost, getPost, getLatestFeedHead, getpostById, getuserPostById } from "../controllers/post.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router()

router.route("/create").post(verifyJWT, upload.fields([
    {
        name: "postImage",
        maxCount: 5
    },
]), createPost)

router.route("/like/:postId").put(verifyJWT, addLike)
router.route("/comment/:postId").put(verifyJWT, addComment)
router.route('/checkifliked/:postId').get(verifyJWT,checkIfLiked)
router.route("/getallpost").get(verifyJWT, getPost)
router.route("/feed/latest").get(verifyJWT, getLatestFeedHead)
router.route("/getuserpostbyId/:userId").get(getuserPostById)
router.route("/getpostbyId/:postId").get(getpostById)

export default router