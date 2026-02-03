const express = require("express");
const OpenAI = require("openai").default;
const auth = require("../middleware/authMiddleware");

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", auth, async (req, res) => {
  try {
    const { project, question } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an academic project assistant." },
        { role: "user", content: `Project: ${project}\nQuestion: ${question}` }
      ]
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ msg: "AI request failed" });
  }
});

module.exports = router;
