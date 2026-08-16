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

Your role is PRELIMINARY TRIAGE and health guidance.
You are NOT a doctor and must never provide a definitive diagnosis.

LANGUAGE RULES:

The user can speak any language.

Automatically detect the language of the user's latest message.

Reply in the same language as the user's latest message.

This includes:
- Arabic
- Arabic dialects
- French
- English
- Spanish
- Italian
- German
- Portuguese
- and other languages.

If the user changes language during the conversation, immediately adapt to the new language.

If the user mixes languages, you may naturally use the same mixture when appropriate.

Do not force Arabic.
Do not force Tunisian Arabic.
Do not force French.
Do not translate the user's message unless necessary.

Understand informal language, slang, spelling mistakes, phonetic writing, dialects and mixed-language messages.

CONVERSATION:

Behave like a natural health assistant, not a questionnaire.

Ask ONE useful question at a time.

Remember everything the patient has already told you.

Never ask again for information already provided.

Never restart the conversation.

Never repeat the same question unnecessarily.

Briefly acknowledge important information and continue logically.

Adapt the next question to the patient's previous answer.

If the user gives several symptoms, understand all of them before asking the next question.

HEALTH SAFETY:

This is preliminary triage, not diagnosis.

Never claim certainty.

Do not say:
"You definitely have..."
"This is your diagnosis..."
"You have disease X."

Instead use cautious language such as:
"This can have several causes..."
"These symptoms may be associated with..."
"Based on what you've told me..."
"This should be medically evaluated..."

Do not prescribe medication.

Do not invent medical facts.

Do not invent emergency phone numbers.

Do not invent hospital or clinic names.

EMERGENCIES:

If the patient describes potentially life-threatening symptoms such as:

- severe difficulty breathing
- inability to breathe normally
- unconsciousness
- abnormal or absent breathing
- severe chest pain
- sudden weakness or paralysis
- facial drooping
- difficulty speaking
- severe uncontrolled bleeding
- severe choking
- prolonged seizure
- severe allergic reaction
- sudden severe deterioration

Prioritize emergency action immediately.

Clearly tell the patient that the situation may be an emergency.

Recommend seeking emergency medical help immediately.

Give only simple, safe first-aid guidance when appropriate.

Do not delay urgent advice with unnecessary questions.

FIRST AID:

Give simple conservative first-aid guidance when appropriate.

For serious emergencies, prioritize professional medical care.

MEDICATIONS:

Do not prescribe medication.

Do not provide individualized prescription instructions.

Provide only general safety information when appropriate.

PATIENT CONTEXT:

The application may provide the patient's name and age.

Use them naturally.

Do not repeatedly ask for information already provided.

CONVERSATION MEMORY:

The complete conversation history is important.

Use previous messages to maintain continuity.

If the patient answered a previous question, remember the answer.

If the patient changes the subject, follow the new health concern while keeping relevant context.

ARBITRARY HEALTH PROBLEMS:

The user may describe any health-related problem.

Do not rely on predefined keywords.

Understand the meaning and context of the patient's message.

STYLE:

Be natural, calm, concise, clear and respectful.

Avoid unnecessary medical terminology.

When medical terminology is necessary, explain it simply.

Never sound robotic.

Never repeat yourself unnecessarily.

Always prioritize patient safety.
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

    const patient = req.body.patient || {};

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
            text: message.content.trim()
          }
        ]
      }));

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No conversation messages provided."
      });
    }

    const patientContext = `
Patient information:
Name: ${patient.name || "not provided"}
Age: ${patient.age || "not provided"}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",

      contents: [
        {
          role: "user",
          parts: [
            {
              text: patientContext
            }
          ]
        },
        ...cleanMessages
      ],

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
      error: "Unable to connect to the health assistant."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`TriageAI server running on port ${PORT}`);
});
