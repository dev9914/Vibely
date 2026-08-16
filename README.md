<div align="center">

# Vibely

### A production-grade, Instagram-inspired social media platform built on the MERN stack

Real-time messaging · Push notifications · Background job processing · Cloud media storage · Kubernetes deployment

[![Live Demo](https://img.shields.io/badge/-Live_Demo-000000?style=for-the-badge&logo=render&logoColor=white)](https://vibely-social-media-app-frontend.onrender.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](#license)

![React](https://img.shields.io/badge/-React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/-Express.js-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/-MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/-Socket.IO-010101?style=flat-square&logo=socket.io&logoColor=white)
![Redis](https://img.shields.io/badge/-Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/-Kubernetes-326CE5?style=flat-square&logo=kubernetes&logoColor=white)

</div>

---

## Overview

Vibely is a full-stack social media platform demonstrating the architecture and engineering practices used in modern production web applications — secure authentication, social interactions, real-time messaging, push notification delivery, scalable background processing, and cloud-native deployment.

It's actively maintained and serves as both a hands-on learning project and a portfolio application showcasing full-stack development and cloud infrastructure work.

**Live Demo:** [vibely-social-media-app-frontend.onrender.com](https://vibely-social-media-app-frontend.onrender.com/)
*(Backend is hosted separately on Render, powering auth, APIs, messaging, notifications, and media management.)*

---

## Features

| Category | Highlights |
|---|---|
| **Authentication** | JWT + refresh token auth, protected routes, persistent sessions, Bcrypt password hashing |
| **User Profiles** | Create/edit profile, profile picture upload, bio, follow/unfollow, suggested users |
| **Posts** | Image upload, create/edit/delete, like/save, personalized feed |
| **Comments** | Add/delete with real-time updates |
| **Messaging** | One-to-one real-time chat via Socket.IO |
| **Notifications** | In-app (like/comment/follow, read state) + push via Firebase Cloud Messaging (multi-device) |
| **Background Jobs** | BullMQ queue on Upstash Redis with retry-backed, worker-based notification processing |
| **Media** | Cloudinary-backed secure, optimized image storage |

---

## Tech Stack

**Frontend** — React, TypeScript, Redux Toolkit, React Router, Tailwind CSS, Shadcn UI, Axios, Socket.IO Client

**Backend** — Node.js, Express.js, MongoDB, Mongoose, JWT, Bcrypt, Socket.IO, BullMQ, Firebase Admin SDK, Cloudinary

**Infrastructure** — MongoDB Atlas, Upstash Redis, Render, Docker, Docker Compose, Kubernetes (AWS EKS), Nginx, GitHub Actions

---

## System Architecture

```
                          React + TypeScript
                                  │
                                  ▼
                          Express.js REST API
                                  │
          ┌──────────────┬────────┴───────────┬──────────────┐
          │              │                    │              │
          ▼              ▼                    ▼              ▼
    MongoDB Atlas   Cloudinary          Socket.IO      Authentication
          │
          ▼
      BullMQ Queue
          │
          ▼
    Upstash Redis
          │
          ▼
 Notification Worker
          │
          ▼
 Firebase Cloud Messaging
          │
          ▼
      User Devices
```

---

## Project Structure

```
Vibely
├── backend
│   ├── src
│   │   ├── controllers
│   │   ├── middleware
│   │   ├── models
│   │   ├── routes
│   │   ├── services
│   │   ├── utils
│   │   └── bootstrap
│   ├── config
│   ├── queues
│   └── package.json
├── frontend
│   ├── src
│   ├── public
│   └── package.json
├── docker
├── k8s
├── .github
└── README.md
```

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/dev9914/Vibely.git
cd Vibely
```

### Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### Configure environment variables

**`backend/.env`**

```env
PORT=

MONGODB_URI=

ACCESS_TOKEN_SECRET=
ACCESS_TOKEN_EXPIRY=

REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_EXPIRY=

CLIENT_URL=

REDIS_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

**`frontend/.env`**

```env
VITE_API_URL=
VITE_SOCKET_URL=
```

### Run locally

```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

---

## Deployment

**Docker** — containerized local development:

```bash
docker-compose up --build
```

**Kubernetes** — manifests included for deployment on AWS EKS:

```bash
kubectl apply -f k8s/
```

**CI/CD** — GitHub Actions workflows handle dependency install, build, Docker image creation, container registry publishing, and Kubernetes deployment on every push.

---

## Screenshots

> Add screenshots here: Authentication · Home Feed · User Profile · Post Creation · Messaging · Notifications · Mobile View

---

## Roadmap

- [ ] Stories
- [ ] Reels & video uploads
- [ ] AI-powered captions
- [ ] User blocking
- [ ] Advanced search
- [ ] Email notifications
- [ ] Performance improvements

---

## What This Project Demonstrates

Full-stack application development · RESTful API design · Authentication & authorization · Real-time communication · Background job processing · Push notification architecture · Cloud media management · Containerization · Kubernetes deployment · CI/CD workflows · Scalable backend architecture

---

## Contributing

Contributions are welcome.

```bash
git checkout -b feature/my-feature
git commit -m "Add new feature"
git push origin feature/my-feature
```

Then open a Pull Request.

---

## License

Licensed under the [MIT License](LICENSE).

---

## Author

**Devanand Kumar**
[GitHub](https://github.com/dev9914) · [LinkedIn](https://www.linkedin.com/in/devanand-kumar-09b451294)
