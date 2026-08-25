import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not configured on the server."
    });
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required." });
    }

    const safeMessages = messages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim()
      )
      .slice(-30);

    if (!safeMessages.length) {
      return res.status(400).json({ error: "No valid messages." });
    }

    const response = await client.responses.create({
      model: MODEL,
      instructions:
        "You are SUPER AI, a helpful Arabic-first AI assistant. " +
        "Answer clearly and accurately. Use Arabic when the user writes Arabic. " +
        "For code, provide clean complete code and explain important changes briefly.",
      input: safeMessages.map((m) => ({
        role: m.role,
        content: m.content
      }))
    });

    return res.status(200).json({
      reply: response.output_text || "لم يتم استلام رد من الذكاء الاصطناعي."
    });
  } catch (error) {
    console.error("OpenAI error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي."
    });
  }
}