const express = require("express");
const Task = require("../models/Task");
const TaskActivity = require("../models/TaskActivity");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { loadProjectIfMember, isProjectUser } = require("../utils/projectAccess");

const router = express.Router();

/* GET ACTIVITY BY PROJECT */
router.get("/activity/:projectId", auth, async (req, res) => {
  try {
    const project = await loadProjectIfMember(req.params.projectId, req.userId);
    if (!project) return res.status(403).json({ msg: "Not authorized" });

    const activities = await TaskActivity.find({ project: req.params.projectId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name email role")
      .populate("task", "text")
      .populate("fromAssignee", "name email role")
      .populate("toAssignee", "name email role");

    res.json(activities);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load activity" });
  }
});

/* CREATE TASK */
router.post("/:projectId", auth, async (req, res) => {
  try {
    const project = await loadProjectIfMember(req.params.projectId, req.userId);
    if (!project) return res.status(403).json({ msg: "Not authorized" });
    const user = await User.findById(req.userId);
    const isOwner = String(project.owner) === String(req.userId);
    const isAdmin = user?.role === "admin";
    const canManage = isOwner || isAdmin;
    const assignedTo = typeof req.body.assignedTo === "string" && req.body.assignedTo.trim()
      ? req.body.assignedTo.trim()
      : null;
    if (assignedTo && !isProjectUser(project, assignedTo)) {
      return res.status(400).json({ msg: "Assignee must be a project member" });
    }
    if (assignedTo && !canManage && String(assignedTo) !== String(req.userId)) {
      return res.status(403).json({ msg: "Only admin/owner can assign others" });
    }

    const task = new Task({
      text: req.body.text,
      status: "To-Do",
      project: req.params.projectId,
      assignedTo,
      createdBy: req.userId
    });

    await task.save();
    await task.populate("assignedTo", "name email role");
    await task.populate("createdBy", "name email role");
    const activity = await TaskActivity.create({
      project: req.params.projectId,
      task: task._id,
      user: req.userId,
      action: "created",
      toStatus: task.status,
      toAssignee: task.assignedTo?._id || null
    });
    await activity.populate("user", "name email role");
    await activity.populate("task", "text");
    await activity.populate("toAssignee", "name email role");
    const io = req.app.get("io");
    if (io) io.to(String(req.params.projectId)).emit("task:created", task);
    if (io) io.to(String(req.params.projectId)).emit("activity:created", activity);
    res.json(task);
  } catch (err) {
    res.status(500).json({ msg: "Task creation failed" });
  }
});

/* GET TASKS */
router.get("/:projectId", auth, async (req, res) => {
  try {
    const project = await loadProjectIfMember(req.params.projectId, req.userId);
    if (!project) return res.status(403).json({ msg: "Not authorized" });

    const tasks = await Task.find({ project: req.params.projectId })
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role");
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load tasks" });
  }
});

/* UPDATE STATUS */
router.put("/:id", auth, async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: "Task not found" });
    const project = await loadProjectIfMember(existing.project, req.userId);
    if (!project) return res.status(403).json({ msg: "Not authorized" });
    const user = await User.findById(req.userId);
    const isOwner = String(project.owner) === String(req.userId);
    const isAdmin = user?.role === "admin";
    const canManage = isOwner || isAdmin;
    const isCreator = existing.createdBy
      ? String(existing.createdBy) === String(req.userId)
      : false;
    const isAssignee = existing.assignedTo
      ? String(existing.assignedTo) === String(req.userId)
      : false;
    const nextAssignedTo = typeof req.body.assignedTo === "string" && req.body.assignedTo.trim()
      ? req.body.assignedTo.trim()
      : null;
    if (nextAssignedTo && !isProjectUser(project, nextAssignedTo)) {
      return res.status(400).json({ msg: "Assignee must be a project member" });
    }

    const updates = {};
    if (typeof req.body.status === "string") updates.status = req.body.status;
    if (typeof req.body.text === "string") updates.text = req.body.text;
    if (req.body.assignedTo === null) {
      updates.assignedTo = null;
    }
    if (typeof req.body.assignedTo === "string" && req.body.assignedTo.trim()) {
      updates.assignedTo = req.body.assignedTo.trim();
    }
    if (updates.assignedTo !== undefined && !canManage) {
      return res.status(403).json({ msg: "Only owner can reassign tasks" });
    }
    const isEditingDetails = updates.text !== undefined || updates.assignedTo !== undefined;
    if (isEditingDetails && !isCreator) {
      return res.status(403).json({ msg: "Only task creator can edit this task" });
    }
    if (!canManage) {
      if (existing.assignedTo && !isAssignee) {
        return res.status(403).json({ msg: "Only assignee can update task status" });
      }
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    )
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role");

    const activityEvents = [];
    if (typeof updates.status === "string" && updates.status !== existing.status) {
      activityEvents.push({
        project: existing.project,
        task: existing._id,
        user: req.userId,
        action: "status_changed",
        fromStatus: existing.status,
        toStatus: updates.status
      });
    }
    const beforeAssignee = existing.assignedTo ? String(existing.assignedTo) : null;
    const afterAssignee = updates.assignedTo === undefined
      ? beforeAssignee
      : updates.assignedTo
      ? String(updates.assignedTo)
      : null;
    if (updates.assignedTo !== undefined && beforeAssignee !== afterAssignee) {
      activityEvents.push({
        project: existing.project,
        task: existing._id,
        user: req.userId,
        action: "assignee_changed",
        fromAssignee: beforeAssignee,
        toAssignee: afterAssignee
      });
    }

    const io = req.app.get("io");
    if (io) io.to(String(existing.project)).emit("task:updated", task);
    if (activityEvents.length && io) {
      const created = await TaskActivity.insertMany(activityEvents);
      const populated = await TaskActivity.find({ _id: { $in: created.map(a => a._id) } })
        .populate("user", "name email role")
        .populate("task", "text")
        .populate("fromAssignee", "name email role")
        .populate("toAssignee", "name email role");
      populated.forEach(a => {
        io.to(String(existing.project)).emit("activity:created", a);
      });
    }
    res.json(task);
  } catch (err) {
    res.status(500).json({ msg: "Task update failed" });
  }
});

/* DELETE TASK */
router.delete("/:id", auth, async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: "Task not found" });
    const project = await loadProjectIfMember(existing.project, req.userId);
    if (!project) return res.status(403).json({ msg: "Not authorized" });
    const user = await User.findById(req.userId);
    const isOwner = String(project.owner) === String(req.userId);
    const isAdmin = user?.role === "admin";
    const canManage = isOwner || isAdmin;
    const isCreator = existing.createdBy
      ? String(existing.createdBy) === String(req.userId)
      : false;
    if (!isCreator) {
      return res.status(403).json({ msg: "Only task creator can delete tasks" });
    }

    await Task.findByIdAndDelete(req.params.id);
    const activity = await TaskActivity.create({
      project: existing.project,
      task: existing._id,
      user: req.userId,
      action: "deleted"
    });
    await activity.populate("user", "name email role");
    await activity.populate("task", "text");
    const io = req.app.get("io");
    if (io) io.to(String(existing.project)).emit("task:deleted", { _id: req.params.id });
    if (io) io.to(String(existing.project)).emit("activity:created", activity);
    res.json({ msg: "Task deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Task deletion failed" });
  }
});

module.exports = router;
