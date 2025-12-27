import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import projectsRouter from "./routes/projects.js";
import chatRouter from "./routes/chat.js";
import planningRouter from "./routes/planning.js";
import assetsRouter from "./routes/assets.js";
import stepsRouter from "./routes/steps.js";
import streamRouter from "./routes/stream.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/projects", projectsRouter);
app.use("/api/projects", chatRouter);
app.use("/api/projects", planningRouter);
app.use("/api/projects", assetsRouter);
app.use("/api/projects", stepsRouter);
app.use("/api/projects", streamRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

