const HOUSE_IDS = ["gryffindor", "slytherin", "ravenclaw", "hufflepuff"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

function normalizeHouseId(value) {
  if (!value) return null;
  const text = String(value).toLowerCase();
  if (text.includes("gryff")) return "gryffindor";
  if (text.includes("slyth")) return "slytherin";
  if (text.includes("raven")) return "ravenclaw";
  if (text.includes("huffle")) return "hufflepuff";
  return null;
}

function cleanTraits(traits) {
  if (!traits || typeof traits !== "object") return null;
  const cleaned = {
    bravery: Math.max(0, Number(traits.bravery) || 0),
    ambition: Math.max(0, Number(traits.ambition) || 0),
    intellect: Math.max(0, Number(traits.intellect) || 0),
    loyalty: Math.max(0, Number(traits.loyalty) || 0)
  };
  const total = Object.values(cleaned).reduce((sum, n) => sum + n, 0);
  if (!total) return null;
  return cleaned;
}

function extractJsonObject(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
}

async function callOpenRouter(apiKey, model, payload) {
  const systemPrompt = [
    "You are a Hogwarts Sorting Hat classifier.",
    "Return only strict JSON with keys:",
    "house (gryffindor|slytherin|ravenclaw|hufflepuff),",
    "confidence (0-100 number),",
    "explanation (one sentence),",
    "traits ({bravery, ambition, intellect, loyalty} numeric percentages)."
  ].join(" ");

  const userPrompt = {
    studentName: payload.studentName,
    answers: payload.answers,
    personalityText: payload.traitsText
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPrompt) }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJsonObject(text);
  if (!parsed) {
    throw new Error("Model response did not include valid JSON");
  }

  const house = normalizeHouseId(parsed.house);
  if (!house || !HOUSE_IDS.includes(house)) {
    throw new Error("Invalid house returned by model");
  }

  return {
    house,
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 75)),
    explanation: String(parsed.explanation || "The hat sees your magical potential clearly.").slice(0, 260),
    traits: cleanTraits(parsed.traits) || { bravery: 25, ambition: 25, intellect: 25, loyalty: 25 }
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/sort") {
      return json({ error: "Not found" }, 404);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!payload?.studentName || !payload?.traitsText) {
      return json({ error: "Missing studentName or traitsText" }, 400);
    }

    if (!env.OPENROUTER_API_KEY) {
      return json({ error: "Missing OPENROUTER_API_KEY secret" }, 500);
    }

    try {
      const model = env.AI_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
      const result = await callOpenRouter(env.OPENROUTER_API_KEY, model, payload);
      return json(result, 200);
    } catch (error) {
      return json({ error: String(error.message || error) }, 502);
    }
  }
};
