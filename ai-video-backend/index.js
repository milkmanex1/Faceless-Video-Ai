import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import { createVideo, getVideosByUser, getVideoById } from "./videosHandler.js";
import renderHandler from "./renderHandler.js";
import { getVoices } from "./voicesHandler.js";
import { getArtStyles } from "./artStylesHandler.js";
import { getMusic } from "./musicHandler.js";

dotenv.config();
const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true
}));

app.use(express.json());

// Root test
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// Video endpoints (no auth for now)
app.post("/api/videos", createVideo);
app.get("/api/videos/user/:user_id", getVideosByUser);
app.get("/api/videos/:id", getVideoById);
app.get("/api/voices", getVoices);
app.get("/api/artstyles", getArtStyles);
app.get("/api/music", getMusic);

// Render endpoint
app.post("/api/render/:id", renderHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
