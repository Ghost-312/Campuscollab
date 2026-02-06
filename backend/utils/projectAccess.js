const Project = require("../models/Project");

const toIdString = value => {
  if (!value) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const isMember = (project, userId) => {
  if (!project || !userId) return false;
  const uid = String(userId);
  if (toIdString(project.owner) === uid) return true;
  return (project.members || []).some(m => toIdString(m) === uid);
};

const isProjectUser = (project, userId) => {
  if (!project || !userId) return false;
  const uid = String(userId);
  if (toIdString(project.owner) === uid) return true;
  return (project.members || []).some(m => toIdString(m) === uid);
};

const isProjectAdmin = (project, userId) => {
  if (!project || !userId) return false;
  const uid = String(userId);
  if (toIdString(project.owner) === uid) return true;
  return (project.admins || []).some(a => toIdString(a) === uid);
};

const loadProjectIfMember = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!isMember(project, userId)) return null;
  return project;
};

module.exports = {
  isMember,
  isProjectUser,
  isProjectAdmin,
  loadProjectIfMember
};
