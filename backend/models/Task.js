const mongoose = require("mongoose");

module.exports = mongoose.model("Task", new mongoose.Schema({
  text: String,
  status: { type: String, default: "To-Do" },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}));
