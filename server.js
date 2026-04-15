const express = require("express");
const cors = require("cors");
const path = require("path");

const env = process.env.NODE_ENV || "development";
require("dotenv").config({ path: path.join(__dirname, `.env.${env}`) });

const authRoutes = require("./routes/auth");
const workspaceRoutes = require("./routes/workspace");
const syncDatabase = require("./models/sync");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Landing page
app.get("/", (_req, res) => {
  res.json({
    name: "DOKSITA API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      workspaces: "/api/workspaces",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);

// Only listen when running locally (not on Vercel)
if (process.env.VERCEL !== "1") {
  syncDatabase()
    .catch((err) => {
      console.error(
        "PERINGATAN: Database tidak terhubung. Menggunakan mode pengembangan (Mock).",
        err.message,
      );
    })
    .finally(() => {
      app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
      });
    });
}

module.exports = app;
