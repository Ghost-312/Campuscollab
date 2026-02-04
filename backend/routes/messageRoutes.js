const express = require("express");
const Message = require("../models/Message");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { loadProjectIfMember } = require("../utils/projectAccess");

const router = express.Router();

/* GET MESSAGES BY PROJECT */
router.get("/:projectId", auth, async (req, res) => {
  try {
    const isGlobal = req.params.projectId === "global";
    if (!isGlobal) {
      const project = await loadProjectIfMember(req.params.projectId, req.userId);
      if (!project) return res.status(403).json({ msg: "Not authorized" });
    }

    const messages = await Message.find(
      isGlobal ? { isGlobal: true } : { project: req.params.projectId }
    )
      .sort({ createdAt: 1 })
      .populate("senderId", "name email role")
      .populate("seenBy", "name email");

    const unseen = messages.filter(
      m =>
        String(m.senderId?._id || m.senderId) !== String(req.userId) &&
        !(m.seenBy || []).some(id => String(id) === String(req.userId))
    );

    if (unseen.length > 0) {
      const ids = unseen.map(m => m._id);
      await Message.updateMany(
        { _id: { $in: ids } },
        { $addToSet: { seenBy: req.userId } }
      );
      const updated = await Message.find({ _id: { $in: ids } })
        .populate("senderId", "name email role")
        .populate("seenBy", "name email");
      const io = req.app.get("io");
      if (io) {
        updated.forEach(message => {
          io.to(String(req.params.projectId)).emit("message:updated", message);
        });
      }
    }
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load messages" });
  }
});

/* CREATE MESSAGE */
router.post("/:projectId", auth, async (req, res) => {
  try {
    const isGlobal = req.params.projectId === "global";
    if (!isGlobal) {
      const project = await loadProjectIfMember(req.params.projectId, req.userId);
      if (!project) return res.status(403).json({ msg: "Not authorized" });
    }

    const user = await User.findById(req.userId);
    const message = new Message({
      project: isGlobal ? undefined : req.params.projectId,
      isGlobal,
      senderId: req.userId,
      sender: user?.name || user?.email || "Member",
      text: req.body.text,
      seenBy: [req.userId]
    });
    await message.save();
    await message.populate("senderId", "name email role");
    await message.populate("seenBy", "name email");
    const io = req.app.get("io");
    if (io) io.to(String(req.params.projectId)).emit("message:created", message);
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: "Message creation failed" });
  }
});

/* UPDATE MESSAGE */
router.put("/:id", auth, async (req, res) => {
  try {
    const existing = await Message.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: "Message not found" });
    if (!existing.isGlobal) {
      const project = await loadProjectIfMember(existing.project, req.userId);
      if (!project) return res.status(403).json({ msg: "Not authorized" });
    }

    const updates = {};
    if (typeof req.body.text === "string") updates.text = req.body.text;
    updates.edited = true;

    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, senderId: req.userId },
      { $set: updates },
      { new: true }
    );
    if (!message) return res.status(403).json({ msg: "Not authorized" });
    await message.populate("senderId", "name email role");
    await message.populate("seenBy", "name email");
    const io = req.app.get("io");
    const roomId = existing.isGlobal ? "global" : String(existing.project);
    if (io) io.to(roomId).emit("message:updated", message);
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: "Message update failed" });
  }
});

/* MARK SEEN */
router.post("/:projectId/seen", auth, async (req, res) => {
  try {
    const isGlobal = req.params.projectId === "global";
    if (!isGlobal) {
      const project = await loadProjectIfMember(req.params.projectId, req.userId);
      if (!project) return res.status(403).json({ msg: "Not authorized" });
    }

    const unseen = await Message.find({
      ...(isGlobal ? { isGlobal: true } : { project: req.params.projectId }),
      senderId: { $ne: req.userId },
      seenBy: { $ne: req.userId }
    }).sort({ createdAt: 1 });

    if (unseen.length > 0) {
      const ids = unseen.map(m => m._id);
      await Message.updateMany(
        { _id: { $in: ids } },
        { $addToSet: { seenBy: req.userId } }
      );
      const updated = await Message.find({ _id: { $in: ids } })
        .populate("senderId", "name email role")
        .populate("seenBy", "name email");
      const io = req.app.get("io");
      if (io) {
        updated.forEach(message => {
          io.to(String(req.params.projectId)).emit("message:updated", message);
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: "Failed to mark messages seen" });
  }
});

/* DELETE MESSAGE */
router.delete("/:id", auth, async (req, res) => {
  try {
    const existing = await Message.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: "Message not found" });
    if (!existing.isGlobal) {
      const project = await loadProjectIfMember(existing.project, req.userId);
      if (!project) return res.status(403).json({ msg: "Not authorized" });
    }

    const deleted = await Message.findOneAndDelete({ _id: req.params.id, senderId: req.userId });
    if (!deleted) return res.status(403).json({ msg: "Not authorized" });
    const io = req.app.get("io");
    const roomId = existing.isGlobal ? "global" : String(existing.project);
    if (io) io.to(roomId).emit("message:deleted", { _id: req.params.id });
    res.json({ msg: "Message deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Message deletion failed" });
  }
});

module.exports = router;
