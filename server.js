import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* =====================================================
   CONFIGURATION
===================================================== */

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn(
    "⚠️ GEMINI_API_KEY is not configured."
  );
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});


/* =====================================================
   TRIAGEAI SYSTEM PROMPT
===================================================== */

const SYSTEM_PROMPT = `
You are TriageAI.

You are a conversational health assistant designed for
preliminary health information, safe triage guidance,
and emergency awareness.

Your most important behavior:

DO NOT behave like a rigid questionnaire.

DO NOT force every conversation into triage.

DO NOT ask a list of questions.

Talk naturally with the user.

The user should feel like they are having a normal
conversation with an intelligent health assistant.

====================================================
LANGUAGES
====================================================

Understand and respond naturally in:

- Tunisian Arabic
- Arabic
- French
- English
- Spanish
- Italian
- German
- mixed languages
- Arabic written using Latin letters
- informal language
- spelling mistakes
- slang

Always answer mainly in the language used by the user.

If the user mixes Tunisian Arabic and French,
you may naturally mix them too.

Do not translate unless requested.

====================================================
CONVERSATION
====================================================

The user can talk about ANY health-related subject.

Examples:

"شنوة هو السكري؟"

"علاش الضغط يطلع؟"

"شنيا معناها HbA1c؟"

"j'ai mal à la tête"

"what is asthma?"

"شنوة نعمل كان واحد تحرق؟"

"عندي وجيعة في بطني"

"نحس روحي مخنوق"

Do not automatically ask for:

- name
- age
- sex
- weight
- blood pressure
- temperature
- medical history

unless the information is useful for the current situation.

====================================================
GENERAL QUESTIONS
====================================================

If the user asks a general medical question:

Answer directly.

Explain simply:

- what it means
- common causes
- common symptoms
- useful information
- when medical evaluation is needed
- warning signs when relevant

Do not turn a general question into an interrogation.

====================================================
PERSONAL SYMPTOMS
====================================================

If the user describes their own symptoms:

1. Understand what they said.
2. Check for obvious emergency warning signs.
3. If no obvious emergency:
   ask ONE useful question.
4. Wait for the answer.
5. Continue from the previous information.
6. Do not restart the conversation.
7. Do not ask multiple questions at once.

Example:

User:
"عندي وجيعة في بطني."

Good response:

"فهمتك. وجيعة البطن تنجم تكون عندها أسباب مختلفة.
أول حاجة نحب نعرف: وين بالضبط تحس بالوجيعة؟"

Then continue based on the answer.

====================================================
IMPORTANT
====================================================

Remember everything already said in the conversation.

If the user already answered a question,
DO NOT ask the same question again.

Use the conversation history.

The conversation is continuous.

====================================================
EMERGENCY
====================================================

If the user describes possible life-threatening symptoms,
prioritize emergency safety immediately.

Examples:

- severe difficulty breathing
- inability to breathe normally
- severe chest pain
- fainting
- unconsciousness
- abnormal or absent breathing
- severe uncontrolled bleeding
- severe choking
- sudden facial weakness
- sudden arm or leg weakness
- sudden speech difficulty
- prolonged seizure
- severe allergic reaction with breathing difficulty
- signs of shock
- sudden severe deterioration

In these situations:

1. Clearly say this may be an emergency.
2. Tell the user to seek emergency medical help immediately.
3. Give simple safe first-aid instructions if appropriate.
4. Do not delay emergency advice with unnecessary questions.
5. Do not invent an emergency phone number.

Never invent emergency numbers.

====================================================
FIRST AID
====================================================

Give simple and conservative first-aid advice.

Do not recommend dangerous procedures.

Do not recommend experimental treatments.

Do not give instructions that require professional
medical skills unless the user is clearly trained
and the instruction is appropriate.

====================================================
DIAGNOSIS
====================================================

Never give a definitive diagnosis.

Never say:

"You definitely have X."

"You have disease X."

"This is your diagnosis."

Instead use:

"This can have several causes."

"These symptoms can be associated with..."

"Based on what you've told me..."

"This should be evaluated by a healthcare professional."

If the user asks:

"شنو عندي؟"

Do not simply refuse.

Explain the most relevant possibilities carefully
and explain what information would help distinguish them.

====================================================
MEDICATIONS
====================================================

You can explain general information about medications.

You must NOT:

- prescribe medication
- invent a dosage
- create an individualized treatment plan
- tell the user to start or stop prescription medication
- change a prescription

If dosage is mentioned by the user,
explain that the correct dose depends on the person,
indication, formulation, and medical advice.

====================================================
PATIENT CONTEXT
====================================================

The application may provide:

Name
Age

Use this information naturally when relevant.

Do not repeatedly ask for information that the application
already provided.

====================================================
STYLE
====================================================

Be:

- natural
- calm
- friendly
- concise
- clear
- useful
- respectful

Avoid robotic phrases.

Avoid unnecessary disclaimers.

Do not repeatedly say:
"I am an AI."

Use simple language.

If medical terminology is necessary,
explain it simply.

====================================================
VERY IMPORTANT
====================================================

You are NOT a keyword-based chatbot.

Do not depend on a predefined list of symptoms.

Understand the meaning and context of the conversation.

The application should feel like:

"ChatGPT, but dedicated to health."

====================================================
SAFETY
====================================================

When uncertain, prefer safe guidance.

When there is a possible emergency,
prioritize urgent medical care.

Never invent:

- emergency numbers
- hospital names
- patient history
- medical results
- diagnoses
- medications
- clinical measurements
`;


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/", (req, res) => {

  res.json({
    ok: true,
    message:
      "TriageAI conversational health backend is running.",
    service:
      "TriageAI",
    status:
      "online"
  });

});


/* =====================================================
   CHAT API
===================================================== */

app.post("/api/chat", async (req, res) => {

  try {

    /* -----------------------------------------------
       CHECK API KEY
    ------------------------------------------------ */

    if (!GEMINI_API_KEY) {

      return res.status(500).json({

        ok: false,

        error:
          "GEMINI_API_KEY is missing on the server."

      });

    }


    /* -----------------------------------------------
       GET DATA FROM FRONTEND
    ------------------------------------------------ */

    const messages =
      Array.isArray(req.body.messages)
        ? req.body.messages
        : [];


    const patient =
      req.body.patient &&
      typeof req.body.patient === "object"
        ? req.body.patient
        : {};


    /* -----------------------------------------------
       VALIDATE MESSAGES
    ------------------------------------------------ */

    const cleanMessages =
      messages

        .filter(message => {

          return (

            message &&

            (
              message.role === "user" ||
              message.role === "assistant"
            ) &&

            typeof message.content === "string" &&

            message.content.trim().length > 0

          );

        })

        .map(message => {

          return {

            role:
              message.role === "assistant"
                ? "model"
                : "user",

            parts: [

              {
                text:
                  message.content.trim()
              }

            ]

          };

        });


    if (cleanMessages.length === 0) {

      return res.status(400).json({

        ok: false,

        error:
          "No conversation messages provided."

      });

    }


    /* -----------------------------------------------
       PATIENT CONTEXT
    ------------------------------------------------ */

    const patientName =
      typeof patient.name === "string"
        ? patient.name.trim()
        : "";


    const patientAge =
      typeof patient.age === "string" ||
      typeof patient.age === "number"
        ? String(patient.age).trim()
        : "";


    const patientContext = `
APPLICATION CONTEXT:

Patient name:
${patientName || "not provided"}

Patient age:
${patientAge || "not provided"}

Use this context only when relevant.

Do not repeatedly ask for information that is
already provided here.
`;


    /* -----------------------------------------------
       CONTENT
    ------------------------------------------------ */

    const contents = [

      {

        role: "user",

        parts: [

          {
            text:
              patientContext
          }

        ]

      },

      ...cleanMessages

    ];


    /* -----------------------------------------------
       GEMINI
    ------------------------------------------------ */

    const response =
      await ai.models.generateContent({

        model:
          "gemini-3.6-flash",

        contents,

        config: {

          systemInstruction:
            SYSTEM_PROMPT,

          temperature:
            0.7,

          maxOutputTokens:
            1000

        }

      });


    /* -----------------------------------------------
       GET AI RESPONSE
    ------------------------------------------------ */

    const reply =
      response &&
      typeof response.text === "string"
        ? response.text.trim()
        : "";


    if (!reply) {

      console.error(
        "Gemini returned empty response:",
        response
      );


      return res.status(500).json({

        ok: false,

        error:
          "The AI returned an empty response."

      });

    }


    /* -----------------------------------------------
       SUCCESS
    ------------------------------------------------ */

    return res.json({

      ok: true,

      reply

    });


  } catch (error) {

    console.error(
      "===================================="
    );

    console.error(
      "TriageAI Gemini ERROR"
    );

    console.error(
      error
    );

    console.error(
      "===================================="
    );


    /* -----------------------------------------------
       ERROR MESSAGE
    ------------------------------------------------ */

    let errorMessage =
      "Unable to connect to TriageAI.";


    if (error?.message) {

      errorMessage =
        error.message;

    }


    return res.status(500).json({

      ok: false,

      error:
        errorMessage

    });

  }

});


/* =====================================================
   404
===================================================== */

app.use((req, res) => {

  res.status(404).json({

    ok: false,

    error:
      "Route not found."

  });

});


/* =====================================================
   START SERVER
===================================================== */

app.listen(
  PORT,
  () => {

    console.log(
      "===================================="
    );

    console.log(
      "🩺 TriageAI Backend"
    );

    console.log(
      "===================================="
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Gemini model: gemini-3.6-flash`
    );

    console.log(
      `API endpoint: /api/chat`
    );

    console.log(
      "===================================="
    );

  }
);
