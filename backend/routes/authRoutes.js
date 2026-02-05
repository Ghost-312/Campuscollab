const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { sendPasswordResetEmail } = require("../utils/mailer");

const router = express.Router();

const normalizeEmail = value => String(value || "").trim().toLowerCase();
const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const findUserByEmail = email =>
  User.findOne({ email: new RegExp(`^${escapeRegExp(email)}$`, "i") });
const isProd = process.env.NODE_ENV === "production";

const isStrongPassword = password => {
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
};

/* REGISTER */
router.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const role = "student";

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ msg: "Enter a valid email address" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        msg: "Password must be at least 8 characters and include upper, lower, number, and symbol."
      });
    }

    const exists = await findUserByEmail(email);
    if (exists) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role
    });

    await user.save();

    res.json({ msg: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Registration failed" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ msg: "Enter a valid email address" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ msg: "Enter correct email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Enter correct email or password" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ msg: "Login failed" });
  }
});

/* FORGOT PASSWORD */
router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ msg: "Email is required" });
    if (!isValidEmail(email)) {
      return res.status(400).json({ msg: "Enter a valid email address" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({ msg: "If the account exists, a reset link was sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetLink
      });
    } catch (err) {
      if (String(err?.message) === "SMTP_NOT_CONFIGURED") {
        if (process.env.NODE_ENV !== "production") {
          return res.json({
            msg: "Email not configured on server. Use the reset link below.",
            resetLink
          });
        }
        return res.status(500).json({ msg: "Email not configured on server" });
      }
      throw err;
    }

    res.json({ msg: "If the account exists, a reset link was sent." });
  } catch (err) {
    res.status(500).json({ msg: "Password reset failed" });
  }
});

/* RESET PASSWORD */
router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "").trim();
    if (!token || !password) {
      return res.status(400).json({ msg: "Token and password are required" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        msg: "Password must be at least 8 characters and include upper, lower, number, and symbol."
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ msg: "Reset link expired or invalid" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        msg: "Password must be at least 8 characters and include upper, lower, number, and symbol."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ msg: "Password updated" });
  } catch (err) {
    res.status(500).json({ msg: "Password reset failed" });
  }
});

/* ADMIN/DEV RESET PASSWORD (non-production only) */
router.post("/admin-reset-password", async (req, res) => {
  if (isProd) {
    return res.status(404).json({ msg: "Not found" });
  }

  const adminToken = process.env.ADMIN_RESET_TOKEN;
  if (!adminToken) {
    return res.status(500).json({ msg: "Admin reset not configured" });
  }

  const providedToken = String(req.headers["x-admin-reset-token"] || "").trim();
  if (providedToken !== adminToken) {
    return res.status(401).json({ msg: "Unauthorized" });
  }

  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ msg: "Enter a valid email address" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        msg: "Password must be at least 8 characters and include upper, lower, number, and symbol."
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ msg: "Password updated" });
  } catch (err) {
    res.status(500).json({ msg: "Password reset failed" });
  }
});

module.exports = router;
