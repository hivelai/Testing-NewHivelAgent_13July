# Testing-NewHivelAgent

A basic MERN (MongoDB, Express, React, Node) stack app — a task manager with full CRUD.

## Structure

- `backend/` — Express + Mongoose REST API (`/api/tasks`)
- `frontend/` — React app (Vite) that consumes the API
- `e2e/` — Playwright + TypeScript UI test suite for the frontend

## Prerequisites

- Node.js 18+
- A running MongoDB instance (local, or a connection string from MongoDB Atlas)

## Backend setup

```bash
cd backend
cp .env.example .env   # edit MONGO_URI if needed
npm install
npm run dev             # starts on http://localhost:5000
```

## Frontend setup

```bash
cd frontend
cp .env.example .env   # points at http://localhost:5000/api by default
npm install
npm run dev             # starts on http://localhost:5173
```

Open http://localhost:5173 — add, complete, and delete tasks. The backend must be running (and connected to MongoDB) for the app to work.

## API

| Method | Route            | Description       |
|--------|------------------|--------------------|
| GET    | /api/tasks       | List all tasks     |
| POST   | /api/tasks       | Create a task      |
| PUT    | /api/tasks/:id   | Update a task      |
| DELETE | /api/tasks/:id   | Delete a task      |
