const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Project = require("./models/Project");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set("io", io);

io.use((socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;
    if (!token || !process.env.JWT_SECRET) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(decoded.id);
    return next();
  } catch {
    return next();
  }
});

io.on("connection", socket => {
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
  }

  socket.on("joinProject", async projectId => {
    try {
      if (!projectId || !socket.userId) return;
      const project = await Project.findOne({
        _id: projectId,
        $or: [{ owner: socket.userId }, { members: socket.userId }]
      }).select("_id");
      if (!project) {
        socket.emit("project:access_denied", { projectId });
        return;
      }
      socket.join(String(projectId));
    } catch {
      socket.emit("project:access_denied", { projectId });
    }
  });
  socket.on("leaveProject", projectId => {
    if (projectId) socket.leave(projectId);
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

  res.json({
    status: "ok",
    time: new Date().toISOString(),
    db: { state: dbState, ok: dbState === 1 },
    smtp: { configured: smtpConfigured }
  });
});

if (require.main === module) {
  const port = process.env.PORT || 5000;
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
