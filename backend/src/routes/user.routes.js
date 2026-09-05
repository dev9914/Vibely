import { Router } from "express";
import { loginUser, registerUser, logoutUser, refreshAccessToken, getSocketToken, getUserDetails, changeCurrentPassword,  
    updateUserAvatar, 
    updateUserCoverImage, 
    getUserChannelProfile, 
    getWatchHistory, 
    updateAccountDetails,
    addFollow,
    unFollow,
    getuserbyId,
    getAllUser,
    checkifFollwed,
    getFollowers} from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {upload} from '../middleware/multer.middleware.js'
import { validate, loginSchema, changePasswordSchema } from '../validators/auth.validator.js';

const router = Router()

// Public routes
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)
router.route("/login").post(validate(loginSchema), loginUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/getuserbyId/:userId").get(getuserbyId)
router.route('/getalluser').get(getAllUser)

// Secured routes (require authentication)
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/socket-token").get(verifyJWT, getSocketToken)
router.route('/getuserdetails').get(verifyJWT, getUserDetails)
router.route("/change-password").post(verifyJWT, validate(changePasswordSchema), changeCurrentPassword)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
router.route("/follow/:followedId").post(verifyJWT, addFollow)
router.route("/unfollow/:unfollowedId").post(verifyJWT, unFollow)
router.route("/checkifFollwed/:foreignId").get(verifyJWT, checkifFollwed)
router.route("/followedlist").post(verifyJWT, getFollowers)

// Unused routes (kept for future use)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getWatchHistory)

export default router