const mongoose = require("mongoose");

const taskActivitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    fromStatus: String,
    toStatus: String,
    fromAssignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    toAssignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskActivity", taskActivitySchema);
