const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const Project = require("./models/Project");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id;
    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", socket => {
  socket.on("joinProject", projectId => {
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    socket.join(projectId);
  });

  socket.on("leaveProject", projectId => {
    socket.leave(projectId);
  });

  socket.on("chatMessage", async data => {
    if (!data?.projectId || !data?.text) return;
    try {
      const project = await Project.findOne({ _id: data.projectId, owner: socket.userId });
      if (!project) return;

      const message = await Message.create({
        project: data.projectId,
        senderId: socket.userId,
        sender: data.sender || "You",
        text: data.text
      });
      io.to(data.projectId).emit("chatMessage", message);
    } catch (err) {}
  });

  socket.on("editMessage", async data => {
    if (!data?.messageId || !data?.text) return;
    try {
      const message = await Message.findOneAndUpdate(
        { _id: data.messageId, senderId: socket.userId },
        { $set: { text: data.text, edited: true } },
        { new: true }
      );
      if (message) {
        io.to(data.projectId || message.project.toString()).emit("editMessage", message);
      }
    } catch (err) {}
  });

  socket.on("deleteMessage", async data => {
    if (!data?.messageId) return;
    try {
      const message = await Message.findOneAndDelete({
        _id: data.messageId,
        senderId: socket.userId
      });
      const projectId = data.projectId || message?.project?.toString();
      if (projectId) io.to(projectId).emit("deleteMessage", { messageId: data.messageId });
    } catch (err) {}
  });

  socket.on("disconnect", () => {});
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
