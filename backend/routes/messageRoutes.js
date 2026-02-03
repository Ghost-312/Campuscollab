const express = require("express");
const Message = require("../models/Message");
const Project = require("../models/Project");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

/* GET MESSAGES BY PROJECT */
router.get("/:projectId", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.userId });
    if (!project) return res.status(403).json({ msg: "Not authorized" });

    const messages = await Message.find({ project: req.params.projectId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load messages" });
  }
});

/* CREATE MESSAGE */
router.post("/:projectId", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.userId });
    if (!project) return res.status(403).json({ msg: "Not authorized" });

    const message = new Message({
      project: req.params.projectId,
      senderId: req.userId,
      sender: req.body.sender || "You",
      text: req.body.text
    });
    await message.save();
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: "Message creation failed" });
  }
});

/* UPDATE MESSAGE */
router.put("/:id", auth, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.text === "string") updates.text = req.body.text;
    updates.edited = true;

    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, senderId: req.userId },
      { $set: updates },
      { new: true }
    );
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: "Message update failed" });
  }
});

/* DELETE MESSAGE */
router.delete("/:id", auth, async (req, res) => {
  try {
    await Message.findOneAndDelete({ _id: req.params.id, senderId: req.userId });
    res.json({ msg: "Message deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Message deletion failed" });
  }
});

module.exports = router;
