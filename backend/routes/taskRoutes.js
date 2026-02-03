const express = require("express");
const Task = require("../models/Task");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

/* CREATE TASK */
router.post("/:projectId", auth, async (req, res) => {
  try {
    const task = new Task({
      text: req.body.text,
      status: "To-Do",
      project: req.params.projectId
    });

    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ msg: "Task creation failed" });
  }
});

/* GET TASKS */
router.get("/:projectId", auth, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load tasks" });
  }
});

/* UPDATE STATUS */
router.put("/:id", auth, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.status === "string") updates.status = req.body.status;
    if (typeof req.body.text === "string") updates.text = req.body.text;

    const task = await Task.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    res.json(task);
  } catch (err) {
    res.status(500).json({ msg: "Task update failed" });
  }
});

/* DELETE TASK */
router.delete("/:id", auth, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ msg: "Task deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Task deletion failed" });
  }
});

module.exports = router;
