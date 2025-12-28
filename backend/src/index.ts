import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import projectsRouter from "./routes/projects.js";
import chatRouter from "./routes/chat.js";
import planningRouter from "./routes/planning.js";
import assetsRouter from "./routes/assets.js";
import stepsRouter from "./routes/steps.js";
import streamRouter from "./routes/stream.js";
import dataRouter from "./routes/data.js";
import videosRouter from "./routes/videos.js";
import { logger } from "./utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS to allow requests from the frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/projects", projectsRouter);
app.use("/api/projects", chatRouter);
app.use("/api/projects", planningRouter);
app.use("/api/projects", assetsRouter);
app.use("/api/projects", stepsRouter);
app.use("/api/projects", streamRouter);
app.use("/api/projects", dataRouter);
app.use("/api/projects", videosRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last, only errors are logged)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Request error", err, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode || 500,
  });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  // Server start message (only errors will be logged from now on)
  console.log(`Server started on port ${PORT}`);
});

