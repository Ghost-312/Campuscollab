const express = require("express");
const Project = require("../models/Project");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

/* CREATE PROJECT */
router.post("/", auth, async (req, res) => {
  try {
    const project = new Project({
      title: req.body.title,
      description: req.body.description,
      owner: req.userId
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
    const projects = await Project.find({ owner: req.userId });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load projects" });
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
    await Project.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    res.json({ msg: "Project deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Project deletion failed" });
  }
});

module.exports = router;
