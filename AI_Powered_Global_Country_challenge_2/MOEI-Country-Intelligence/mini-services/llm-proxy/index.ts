/**
 * OpenAI-compatible API proxy backed by Z SDK WEB.
 *
 * Exposes POST /v1/chat/completions that the Python litellm client
 * can talk to, translating requests/responses to/from Z SDK WEB format.
 *
 * Port: 3040
 */
import ZAI from "z-ai-web-dev-sdk";

const PORT = 3040;

let zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function initSDK() {
  if (!zai) {
    zai = await ZAI.create();
    console.log("[llm-proxy] Z SDK WEB initialized");
  }
  return zai;
}

// ── OpenAI-compatible response builder ──────────────────────────────────

function makeCompletion(
  content: string,
  model: string,
  finishReason = "stop"
) {
  const id = `chatcmpl-${Date.now().toString(36)}`;
  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: finishReason,
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// ── Request handler ─────────────────────────────────────────────────────

async function handleCompletions(body: any): Promise<Response> {
  const model = body.model || "default";
  const messages = body.messages || [];
  const temperature = body.temperature ?? 0;
  const jsonMode =
    body.response_format?.type === "json_object" ||
    body.response_format === "json_object";

  // Build Z SDK messages — convert "system" role to "assistant" role
  // (Z SDK WEB uses "assistant" for system prompts)
  const zaiMessages = messages.map((m: any) => ({
    role: m.role === "system" ? ("assistant" as const) : (m.role as any),
    content: m.content,
  }));

  // If JSON mode, inject a hint into the last assistant message
  if (jsonMode && zaiMessages.length > 0) {
    const lastAssistant = [...zaiMessages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistant) {
      lastAssistant.content +=
        "\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no explanation, just pure JSON.";
    } else {
      zaiMessages.unshift({
        role: "assistant",
        content:
          "You MUST respond with ONLY valid JSON. No markdown, no explanation, just pure JSON.",
      });
    }
  }

  try {
    const sdk = await initSDK();
    const completion = await sdk.chat.completions.create({
      messages: zaiMessages,
      thinking: { type: "disabled" },
    });

    let content = completion.choices[0]?.message?.content || "";

    // Clean up JSON mode responses — strip markdown code blocks if present
    if (jsonMode && content) {
      content = content.trim();
      if (content.startsWith("```")) {
        content = content
          .replace(/^```[a-zA-Z]*\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
      }
    }

    const response = makeCompletion(content, model);
    return Response.json(response);
  } catch (err: any) {
    console.error("[llm-proxy] Z SDK error:", err?.message || err);
    return Response.json(
      {
        error: {
          message: err?.message || "LLM proxy error",
          type: "proxy_error",
          code: "z_sdk_error",
        },
      },
      { status: 502 }
    );
  }
}

// ── Server using node:http for stability ────────────────────────────────
import { createServer } from "node:http";

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", provider: "z-sdk-web" }));
    return;
  }

  // Models list
  if (
    (url.pathname === "/v1/models" || url.pathname === "/models") &&
    req.method === "GET"
  ) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data: [
          {
            id: "z-sdk-default",
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "z-sdk-web",
          },
        ],
      })
    );
    return;
  }

  // Chat completions
  if (
    (url.pathname === "/v1/chat/completions" ||
      url.pathname === "/chat/completions") &&
    req.method === "POST"
  ) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const result = await handleCompletions(body);
      const responseBody = await result.text();
      res.writeHead(result.status, {
        "Content-Type": "application/json",
      });
      res.end(responseBody);
    } catch (err: any) {
      console.error("[llm-proxy] Request error:", err?.message || err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message: "Invalid request body",
            type: "invalid_request_error",
          },
        })
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[llm-proxy] Listening on http://localhost:${PORT}`);
  console.log(
    `[llm-proxy] OpenAI-compatible API proxy backed by Z SDK WEB`
  );
});

// Keep the process alive
process.on("uncaughtException", (err) => {
  console.error("[llm-proxy] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[llm-proxy] Unhandled rejection:", reason);
});
