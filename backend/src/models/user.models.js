import mongoose from "mongoose";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true, 
        minlength: 3,
  maxlength: 30,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowecase: true,
        trim: true, 
    },
    fullName: {
        type: String,
        required: true,
        trim: true, 
        index: true
    },
    avatar: {
        type: String, // cloudinary url
        required: true,
    },
    coverImage: {
        type: String, // cloudinary url
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    refreshToken: {
        type: String
    },
    followers:[{
      type: Schema.Types.ObjectId,
      ref: "User"
    }],
    following: [{
      type: Schema.Types.ObjectId,
      ref: "User"
    }],
    blockedUsers: [{
      type: Schema.Types.ObjectId,
      ref: "User"
    }],
    mutedUsers: [{
      type: Schema.Types.ObjectId,
      ref: "User"
    }],
    noOfFollower: {
      type: Number,
      default: 0
    },
    noOfFollowing: {
      type: Number,
      default: 0
    },
    bio: {
  type: String,
  default: "",
  trim: true,
},

website: {
  type: String,
  default: "",
  trim: true,
},

location: {
  type: String,
  default: "",
  trim: true,
},
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    // 🔔 FCM Push Notification Tokens
    fcmTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        platform: {
          type: String,
          enum: ['web', 'android', 'ios', 'desktop'],
          default: 'web',
        },
        deviceId: {
          type: String,
          required: true,
          index: true,
        },
        userAgent: {
          type: String,
          default: '',
        },
        lastUsed: {
          type: Date,
          default: Date.now,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        registeredAt: {
          type: Date,
          default: Date.now,
        },
      }
    ],

},
  { timestamps: true }
);

UserSchema.index({ username: 1, createdAt: -1 });
UserSchema.index({ fullName: 1, createdAt: -1 });

UserSchema.pre("save", async function (next) {
  if(!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10)
  next()
})

UserSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password,this.password)
}

UserSchema.methods.generateAccessToken = function(){
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  )
}

UserSchema.methods.generateRefreshToken = function(){
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  )
}

export const User = mongoose.model("User", UserSchema);
