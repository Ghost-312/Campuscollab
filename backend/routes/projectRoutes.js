const express = require("express");
const crypto = require("crypto");
const Project = require("../models/Project");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { isMember } = require("../utils/projectAccess");
const { sendInviteEmail } = require("../utils/mailer");

const generateCode = async () => {
  let code = "";
  let exists = true;
  while (exists) {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
    // eslint-disable-next-line no-await-in-loop
    exists = await Project.exists({ code });
  }
  return code;
};

const isOwnerOrAdmin = (project, user) => {
  if (!project || !user) return false;
  if (String(project.owner) === String(user._id)) return true;
  return user.role === "admin";
};

const router = express.Router();

/* CREATE PROJECT */
router.post("/", auth, async (req, res) => {
  try {
    const code = await generateCode();

    const project = new Project({
      title: req.body.title,
      description: req.body.description,
      owner: req.userId,
      members: [req.userId],
      code
    });

    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ msg: "Project creation failed" });
  }
});

/* GET PROJECTS */
router.get("/", auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.userId }, { members: req.userId }]
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load projects" });
  }
});

/* GET PROJECT DETAIL */
router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const project = await Project.findById(req.params.id)
      .populate("members", "name email role")
      .populate("owner", "name email role");
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!project.code && String(project.owner?._id || project.owner) === String(req.userId)) {
      project.code = await generateCode();
      await project.save();
    }
    const members = project.members || [];
    const ownerId = String(project.owner?._id || project.owner);
    const hasOwner = members.some(m => String(m._id || m) === ownerId);
    const mergedMembers = hasOwner ? members : [project.owner, ...members];
    const safeProject = project.toObject();
    if (!isOwnerOrAdmin(project, user)) {
      safeProject.code = undefined;
    }
    res.json({ ...safeProject, members: mergedMembers });
  } catch (err) {
    res.status(500).json({ msg: "Failed to load project" });
  }
});

/* INVITE (GET CODE) */
router.post("/:id/invite", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!isOwnerOrAdmin(project, user)) {
      return res.status(403).json({ msg: "Admin or owner required" });
    }
    if (project.inviteEnabled === false) {
      return res.status(403).json({ msg: "Invites are disabled" });
    }
    if (!project.code) {
      project.code = await generateCode();
      await project.save();
    }
    res.json({ code: project.code });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch invite code" });
  }
});

/* INVITE BY EMAIL */
router.post("/:id/invite/email", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!isOwnerOrAdmin(project, user)) {
      return res.status(403).json({ msg: "Admin or owner required" });
    }
    if (project.inviteEnabled === false) {
      return res.status(403).json({ msg: "Invites are disabled" });
    }
    const email = String(req.body.email || "").trim();
    if (!email) return res.status(400).json({ msg: "Email is required" });

    if (!project.code) {
      project.code = await generateCode();
      await project.save();
    }

    const appBase = process.env.APP_BASE_URL || "";
    const inviteLink = appBase ? `${appBase}?code=${project.code}` : "";

    await sendInviteEmail({
      to: email,
      projectName: project.title || "Campus Collab Project",
      code: project.code,
      inviteLink
    });

    res.json({ msg: "Invite sent" });
  } catch (err) {
    if (String(err?.message || "") === "SMTP_NOT_CONFIGURED") {
      return res.status(500).json({ msg: "Email not configured on server" });
    }
    res.status(500).json({ msg: "Failed to send invite" });
  }
});

/* INVITE SETTINGS */
router.post("/:id/invite/settings", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!isOwnerOrAdmin(project, user)) {
      return res.status(403).json({ msg: "Admin or owner required" });
    }
    if (typeof req.body.inviteEnabled !== "boolean") {
      return res.status(400).json({ msg: "inviteEnabled must be boolean" });
    }
    project.inviteEnabled = req.body.inviteEnabled;
    await project.save();
    res.json({ inviteEnabled: project.inviteEnabled });
  } catch (err) {
    res.status(500).json({ msg: "Failed to update invite settings" });
  }
});

/* REGENERATE INVITE CODE */
router.post("/:id/invite/regenerate", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!isOwnerOrAdmin(project, user)) {
      return res.status(403).json({ msg: "Admin or owner required" });
    }
    if (project.inviteEnabled === false) {
      return res.status(403).json({ msg: "Invites are disabled" });
    }
    project.code = await generateCode();
    await project.save();
    res.json({ code: project.code });
  } catch (err) {
    res.status(500).json({ msg: "Failed to regenerate code" });
  }
});

/* JOIN PROJECT BY CODE */
router.post("/join/code", auth, async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ msg: "Project code required" });

    const project = await Project.findOne({ code });
    if (!project) return res.status(404).json({ msg: "Project not found" });
    if (project.inviteEnabled === false) {
      return res.status(403).json({ msg: "Invites are disabled" });
    }

    if (!isMember(project, req.userId)) {
      project.members = [...(project.members || []), req.userId];
      await project.save();
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ msg: "Failed to join project" });
  }
});

/* UPDATE PROJECT */
router.put("/:id", auth, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.title === "string") updates.title = req.body.title;
    if (typeof req.body.description === "string") updates.description = req.body.description;

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { $set: updates },
      { new: true }
    );

    res.json(project);
  } catch (err) {
    res.status(500).json({ msg: "Project update failed" });
  }
});

/* DELETE PROJECT */
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!isOwnerOrAdmin(project, user)) {
      return res.status(403).json({ msg: "Admin or owner required" });
    }
    await Project.findByIdAndDelete(req.params.id);
    res.json({ msg: "Project deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Project deletion failed" });
  }
});

module.exports = router;
