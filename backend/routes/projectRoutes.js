const express = require("express");
const crypto = require("crypto");
const Project = require("../models/Project");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { isMember, isProjectAdmin } = require("../utils/projectAccess");
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

const isOwner = (project, user) => {
  if (!project || !user) return false;
  return String(project.owner) === String(user._id);
};

const hasProjectLeadership = (project, userId) => {
  if (!project || !userId) return false;
  return isProjectAdmin(project, userId);
};

const router = express.Router();

const refreshAndSendProject = async (res, projectId, userId) => {
  const project = await Project.findById(projectId)
    .populate("members", "name email role")
    .populate("owner", "name email role")
    .populate("admins", "name email role");
  if (!project) return res.status(404).json({ msg: "Project not found" });

  const members = project.members || [];
  const ownerId = String(project.owner?._id || project.owner);
  const hasOwner = members.some(m => String(m._id || m) === ownerId);
  const mergedMembers = hasOwner ? members : [project.owner, ...members];
  const safeProject = project.toObject();
  safeProject.ownerName = project.owner?.name || "";
  safeProject.ownerId = String(project.owner?._id || project.owner || "");
  const user = await User.findById(userId);
  if (!isOwner(project, user)) {
    safeProject.code = undefined;
  }
  return res.json({ ...safeProject, members: mergedMembers });
};

/* CREATE PROJECT */
router.post("/", auth, async (req, res) => {
  try {
    const code = await generateCode();

    const project = new Project({
      title: req.body.title,
      description: req.body.description,
      owner: req.userId,
      members: [req.userId],
      admins: [],
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
    const project = await Project.findById(req.params.id)
      .populate("members", "name email role")
      .populate("owner", "name email role")
      .populate("admins", "name email role");
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
    safeProject.ownerName = project.owner?.name || "";
    safeProject.ownerId = String(project.owner?._id || project.owner || "");
    const user = await User.findById(req.userId);
    if (!isOwner(project, user)) {
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
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!hasProjectLeadership(project, req.userId)) {
      return res.status(403).json({ msg: "Owner/admin required" });
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
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!hasProjectLeadership(project, req.userId)) {
      return res.status(403).json({ msg: "Owner/admin required" });
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

    const appBase = String(process.env.APP_BASE_URL || process.env.CLIENT_URL || "").replace(/\/+$/, "");
    const siteUrl = appBase || "";
    const loginUrl = appBase ? `${appBase}/` : "";
    const inviteLink = appBase ? `${appBase}/?code=${project.code}` : "";

    await sendInviteEmail({
      to: email,
      projectName: project.title || "Campus Collab Project",
      code: project.code,
      inviteLink,
      siteUrl,
      loginUrl
    });

    res.json({ msg: "Invite sent" });
  } catch (err) {
    if (String(err?.message || "") === "SMTP_NOT_CONFIGURED") {
      return res.status(500).json({ msg: "Email not configured on server" });
    }
    res.status(500).json({ msg: "Failed to send invite" });
  }
});

/* SET PROJECT ADMIN ACCESS (OWNER ONLY) */
router.post("/:id/admins", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    const user = await User.findById(req.userId);
    if (!isOwner(project, user)) {
      return res.status(403).json({ msg: "Owner required" });
    }

    const memberId = String(req.body.memberId || "").trim();
    const isAdmin = Boolean(req.body.isAdmin);
    if (!memberId) return res.status(400).json({ msg: "memberId is required" });
    if (String(project.owner) === memberId) {
      return res.status(400).json({ msg: "Owner already has full access" });
    }
    const memberExists = (project.members || []).some(m => String(m) === memberId);
    if (!memberExists) {
      return res.status(400).json({ msg: "Member not found in this project" });
    }

    const adminSet = new Set((project.admins || []).map(a => String(a)));
    if (isAdmin) adminSet.add(memberId);
    if (!isAdmin) adminSet.delete(memberId);
    project.admins = Array.from(adminSet);
    await project.save();

    const io = req.app.get("io");
    if (io) {
      io.to(String(project._id)).emit("project:admin_updated", {
        projectId: String(project._id),
        memberId,
        isAdmin
      });
    }

    return res.json({ msg: isAdmin ? "Admin access granted" : "Admin access removed" });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to update admin access" });
  }
});

/* REMOVE MEMBER */
router.delete("/:id/members/:memberId", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    const isLeader = hasProjectLeadership(project, req.userId);
    if (!isLeader) {
      return res.status(403).json({ msg: "Owner/admin required" });
    }

    const memberId = String(req.params.memberId || "");
    const ownerId = String(project.owner);
    if (!memberId) return res.status(400).json({ msg: "Member id required" });
    if (memberId === ownerId) {
      return res.status(400).json({ msg: "Project owner cannot be removed" });
    }
    const requestorIsOwner = String(req.userId) === ownerId;
    const targetIsAdmin = (project.admins || []).some(a => String(a) === memberId);
    if (!requestorIsOwner && targetIsAdmin) {
      return res.status(403).json({ msg: "Only owner can remove project admins" });
    }

    const beforeCount = (project.members || []).length;
    project.members = (project.members || []).filter(m => String(m) !== memberId);
    project.admins = (project.admins || []).filter(a => String(a) !== memberId);
    if (project.members.length === beforeCount) {
      return res.status(404).json({ msg: "Member not found in this project" });
    }
    await project.save();
    const io = req.app.get("io");
    if (io) {
      const projectId = String(project._id);
      io.to(projectId).emit("project:member_removed", { projectId, userId: memberId });
      io.to(`user:${memberId}`).emit("project:access_revoked", { projectId });
      const sockets = await io.in(projectId).fetchSockets();
      sockets.forEach(s => {
        if (String(s.userId || "") === memberId) {
          s.leave(projectId);
          s.emit("project:access_revoked", { projectId });
        }
      });
    }
    return res.json({ msg: "Member removed" });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to remove member" });
  }
});

/* LEAVE PROJECT (MEMBER SELF-REMOVE) */
router.post("/:id/leave", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    if (String(project.owner) === String(req.userId)) {
      return res.status(400).json({ msg: "Owner cannot leave the project. Delete it or transfer ownership." });
    }

    project.members = (project.members || []).filter(m => String(m) !== String(req.userId));
    project.admins = (project.admins || []).filter(a => String(a) !== String(req.userId));
    await project.save();
    const io = req.app.get("io");
    if (io) {
      const projectId = String(project._id);
      io.to(projectId).emit("project:member_left", { projectId, userId: String(req.userId) });
      const sockets = await io.in(projectId).fetchSockets();
      sockets.forEach(s => {
        if (String(s.userId || "") === String(req.userId)) {
          s.leave(projectId);
        }
      });
    }
    return res.json({ msg: "You left the project" });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to leave project" });
  }
});

/* TRANSFER OWNERSHIP (OWNER ONLY) */
router.post("/:id/transfer-owner", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    const user = await User.findById(req.userId);
    if (!isOwner(project, user)) {
      return res.status(403).json({ msg: "Owner required" });
    }

    const nextOwnerId = String(req.body.nextOwnerId || "").trim();
    if (!nextOwnerId) return res.status(400).json({ msg: "nextOwnerId is required" });
    if (String(project.owner) === nextOwnerId) {
      return res.status(400).json({ msg: "Selected member is already the owner" });
    }

    const memberExists = (project.members || []).some(m => String(m) === nextOwnerId);
    if (!memberExists) {
      return res.status(400).json({ msg: "New owner must be a project member" });
    }

    project.owner = nextOwnerId;
    project.admins = (project.admins || []).filter(a => String(a) !== nextOwnerId);
    if (!(project.members || []).some(m => String(m) === String(req.userId))) {
      project.members = [...(project.members || []), req.userId];
    }
    await project.save();
    const io = req.app.get("io");
    if (io) {
      io.to(String(project._id)).emit("project:owner_transferred", {
        projectId: String(project._id),
        ownerId: String(nextOwnerId)
      });
    }
    return res.json({ msg: "Ownership transferred" });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to transfer ownership" });
  }
});

/* INVITE SETTINGS */
router.post("/:id/invite/settings", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!hasProjectLeadership(project, req.userId)) {
      return res.status(403).json({ msg: "Owner/admin required" });
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
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!hasProjectLeadership(project, req.userId)) {
      return res.status(403).json({ msg: "Owner/admin required" });
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
      const io = req.app.get("io");
      if (io) {
        const projectId = String(project._id);
        io.to(projectId).emit("project:member_joined", { projectId, userId: String(req.userId) });
      }
    }

    return refreshAndSendProject(res, project._id, req.userId);
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

    const projectDoc = await Project.findById(req.params.id);
    if (!isMember(projectDoc, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (!hasProjectLeadership(projectDoc, req.userId)) {
      return res.status(403).json({ msg: "Only project owner/admin can edit project" });
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id },
      { $set: updates },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ msg: "Project not found" });
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ msg: "Project update failed" });
  }
});

/* DELETE PROJECT */
router.delete("/:id", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!isMember(project, req.userId)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    const user = await User.findById(req.userId);
    if (!isOwner(project, user)) {
      return res.status(403).json({ msg: "Owner required" });
    }
    await Project.findByIdAndDelete(req.params.id);
    res.json({ msg: "Project deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Project deletion failed" });
  }
});

module.exports = router;
