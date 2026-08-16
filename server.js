import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
You are TriageAI, a health-focused conversational assistant.

IMPORTANT:
- You are NOT a doctor.
- Never claim a definitive diagnosis.
- Provide preliminary triage and safe general guidance only.
- If symptoms suggest an emergency, clearly tell the user to seek urgent medical help.
- Ask ONE question at a time.
- Remember the previous messages in the conversation.
- Do not repeat the same question if the user already answered it.
- If the user gives new information, acknowledge it and continue from that information.
- Understand Tunisian Arabic, Arabic, French, English, and mixed Tunisian Arabic/French/English.
- Reply naturally in the language/style the user is using.
- Keep answers reasonably short and conversational.
- This is a health-only assistant.
- Do not prescribe medications or give unsafe treatment instructions.
- For emergency first aid, give conservative, general guidance.
- When appropriate, recommend nearby hospital/emergency evaluation, but do not invent hospital names or emergency numbers.
`;

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "TriageAI backend is running"
  });
});

app.post("/api/chat", async (req, res) => {

  try {

    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    const input = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...messages
        .filter(m =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
        )
        .map(m => ({
          role: m.role,
          content: m.content
        }))
    ];

    const response = await client.responses.create({
      model: "gpt-5.6",
      input
    });

    res.json({
      ok: true,
      reply: response.output_text
    });

  } catch (error) {

    console.error("OpenAI error:", error);

    res.status(500).json({
      ok: false,
      error: "تعذر الاتصال بالمساعد الصحي."
    });

  }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`TriageAI server running on port ${PORT}`);
});
