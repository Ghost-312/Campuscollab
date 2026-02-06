const mongoose = require("mongoose");

module.exports = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true, trim: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "admin", "faculty"], default: "student" },
  resetTokenHash: String,
  resetTokenExpires: Date
}));
