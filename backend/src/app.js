import express from 'express'
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApiError } from './utils/ApiError.js';

const app = express();



  app.use(cors({
    origin: ['http://localhost:4000','https://vibely-social-media-app-frontend.onrender.com'],
    credentials: true
}))

app.use(express.json({limit:'16kb'}))
app.use(express.urlencoded({extended:true}))
app.use(express.static('public'))
app.use(cookieParser())

//routes import
import userRouter from './routes/user.routes.js'
import postRouter from './routes/post.routes.js'
import messageRouter from './routes/message.routes.js'
import captionRouter from './routes/aiFeature.routes.js'
import notificationRouter from './routes/notification.routes.js'
import savedRouter from './routes/saved.routes.js'
import storyRouter from './routes/story.routes.js'
import exploreRouter from './routes/explore.routes.js'
import searchRouter from './routes/search.routes.js'

//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/post",postRouter)
app.use("/api/v1/message", messageRouter)
app.use("/api/v1/ai", captionRouter)
app.use("/api/v1/notifications", notificationRouter)
app.use("/api/v1/saved", savedRouter)
app.use("/api/v1/stories", storyRouter)
app.use("/api/v1/explore", exploreRouter)
app.use("/api/v1/search", searchRouter)

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  const statusCode = err instanceof ApiError ? err.statusCode : err?.statusCode || 500
  const message = err instanceof ApiError ? err.message : err?.message || 'Internal Server Error'

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err?.errors || [],
    stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
  })
})


export {app}
