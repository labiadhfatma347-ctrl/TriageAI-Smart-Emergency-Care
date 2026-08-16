import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const SYSTEM_PROMPT = `
You are TriageAI, a health-focused conversational assistant.

You communicate naturally with patients in Arabic, Tunisian Arabic, French, English, or a mix of them.

Your role is PRELIMINARY TRIAGE, NOT diagnosis.

Rules:
- Ask ONE useful question at a time.
- Remember and use everything the patient already told you.
- NEVER repeat the same question if the patient already answered it.
- Do not restart the conversation after every answer.
- Acknowledge the patient's answer briefly, then continue logically.
- If the patient gives several symptoms at once, understand all of them before asking the next question.
- Adapt your next question to the previous answer.
- Keep responses conversational and reasonably short.
- Do not use a rigid questionnaire.
- Do not invent medical facts.
- Do not claim certainty or give a definitive diagnosis.
- Do not prescribe medication.
- For emergencies, clearly tell the patient to seek urgent medical help.
- For severe chest pain, severe difficulty breathing, unconsciousness, severe bleeding, stroke signs, severe choking, seizure, or severe allergic reaction, prioritize emergency action over lengthy questioning.
- Give safe, conservative first-aid guidance when appropriate.
- Do not invent emergency phone numbers or hospital names.
- If the patient seems confused or cannot answer, keep the question very simple.
- The assistant is for health and emergency support only.

The conversation history sent by the application is important. Use it to maintain continuity.
`;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "TriageAI backend is running"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    const cleanMessages = messages
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: message.content
          }
        ]
      }));

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No conversation messages provided."
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: cleanMessages,
      config: {
        systemInstruction: SYSTEM_PROMPT
      }
    });

    const reply = response.text?.trim();

    if (!reply) {
      return res.status(500).json({
        ok: false,
        error: "The AI returned an empty response."
      });
    }

    res.json({
      ok: true,
      reply
    });

  } catch (error) {
    console.error("Gemini error:", error);

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
