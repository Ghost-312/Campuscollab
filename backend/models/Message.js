const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    isGlobal: { type: Boolean, default: false },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sender: { type: String, default: "User" },
    text: { type: String, required: true },
    edited: { type: Boolean, default: false },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
