import ZAI from "z-ai-web-dev-sdk";
import { createServer } from "node:http";

const PORT = 3040;
let zai: any = null;

async function getSDK() {
  if (!zai) {
    zai = await ZAI.create();
    console.log("[llm-proxy] Z SDK WEB initialized");
  }
  return zai;
}

function makeCompletion(content: string, model: string) {
  return {
    id: `chatcmpl-${Date.now().toString(36)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function jsonResponse(res: any, data: any, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);

    if (url.pathname === "/health" && req.method === "GET") {
      jsonResponse(res, { status: "ok", provider: "z-sdk-web" });
      return;
    }

    if ((url.pathname === "/v1/models" || url.pathname === "/models") && req.method === "GET") {
      jsonResponse(res, {
        object: "list",
        data: [{ id: "z-sdk-default", object: "model", created: Math.floor(Date.now() / 1000), owned_by: "z-sdk-web" }],
      });
      return;
    }

    if ((url.pathname === "/v1/chat/completions" || url.pathname === "/chat/completions") && req.method === "POST") {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const model = body.model || "default";
      const messages = body.messages || [];
      const jsonMode = body.response_format?.type === "json_object" || body.response_format === "json_object";

      // Convert "system" role to "assistant" for Z SDK WEB
      const zaiMessages = messages.map((m: any) => ({
        role: m.role === "system" ? "assistant" : m.role,
        content: m.content,
      }));

      // JSON mode hint
      if (jsonMode && zaiMessages.length > 0) {
        const lastAssistant = [...zaiMessages].reverse().find((m: any) => m.role === "assistant");
        if (lastAssistant) {
          lastAssistant.content += "\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no explanation, just pure JSON.";
        } else {
          zaiMessages.unshift({ role: "assistant", content: "You MUST respond with ONLY valid JSON." });
        }
      }

      try {
        const sdk = await getSDK();
        const completion = await sdk.chat.completions.create({
          messages: zaiMessages,
          thinking: { type: "disabled" },
        });

        let content = completion.choices[0]?.message?.content || "";

        if (jsonMode && content) {
          content = content.trim();
          if (content.startsWith("```")) {
            content = content.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
          }
        }

        jsonResponse(res, makeCompletion(content, model));
      } catch (sdkErr: any) {
        console.error("[llm-proxy] SDK error:", sdkErr?.message || sdkErr);
        jsonResponse(res, { error: { message: sdkErr?.message || "LLM proxy error", type: "proxy_error", code: "z_sdk_error" } }, 502);
      }
      return;
    }

    jsonResponse(res, { error: "Not found" }, 404);
  } catch (err: any) {
    console.error("[llm-proxy] Server error:", err?.message || err);
    try { jsonResponse(res, { error: { message: "Internal server error" } }, 500); } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`[llm-proxy] Listening on http://localhost:${PORT}`);
  console.log(`[llm-proxy] OpenAI-compatible API proxy backed by Z SDK WEB`);
});

process.on("uncaughtException", (err) => {
  console.error("[llm-proxy] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[llm-proxy] Unhandled rejection:", reason);
});
