const mongoose = require("mongoose");

module.exports = mongoose.model("Project", new mongoose.Schema({
  title: String,
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}));
