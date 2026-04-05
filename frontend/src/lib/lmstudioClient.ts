export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface StreamChunk {
  type: "reasoning" | "content";
  text: string;
}

export const SYSTEM_PROMPT = `あなたは優秀なアシスタントです。必ず日本語で回答してください。
添付される画像は書籍のPDFから抽出したページ画像です。内容はページ順に並んでおり、文章や図表が次のページに続いている場合があります。ページをまたいだ内容も一連の流れとして読み取ってください。`;

export async function fetchModels(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/v1/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  return (data.data as { id: string }[]).map((m) => m.id);
}

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface ChatOptions {
  reasoningEffort?: ReasoningEffort;
  signal?: AbortSignal;
}

export async function* streamChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<StreamChunk> {
  const withSystem: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  const body: Record<string, unknown> = {
    model,
    messages: withSystem,
    stream: true,
  };

  if (options.reasoningEffort && options.reasoningEffort !== "none") {
    body.reasoning = { effort: options.reasoningEffort };
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LM Studio error ${res.status}: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // <think>タグのストリーム中パース用
  let inThinkTag = false;
  let tagBuf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return;

      let chunk: { choices?: { delta?: { content?: string; reasoning_content?: string } }[] };
      try {
        chunk = JSON.parse(json);
      } catch {
        continue;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      // reasoning_content フィールド (DeepSeek-R1 など)
      if (delta.reasoning_content) {
        yield { type: "reasoning", text: delta.reasoning_content };
      }

      // content フィールド — <think>タグをストリーム中に分離
      if (delta.content) {
        let text = delta.content;

        // tagBuf に未確定の < がある場合は結合して処理
        if (tagBuf) {
          text = tagBuf + text;
          tagBuf = "";
        }

        while (text.length > 0) {
          if (inThinkTag) {
            const end = text.indexOf("</think>");
            if (end === -1) {
              yield { type: "reasoning", text };
              text = "";
            } else {
              if (end > 0) yield { type: "reasoning", text: text.slice(0, end) };
              inThinkTag = false;
              text = text.slice(end + 8);
            }
          } else {
            const start = text.indexOf("<think>");
            if (start === -1) {
              // 末尾が < で始まる不完全タグの可能性
              const lt = text.lastIndexOf("<");
              if (lt !== -1 && lt > text.length - 8) {
                if (lt > 0) yield { type: "content", text: text.slice(0, lt) };
                tagBuf = text.slice(lt);
              } else {
                yield { type: "content", text };
              }
              text = "";
            } else {
              if (start > 0) yield { type: "content", text: text.slice(0, start) };
              inThinkTag = true;
              text = text.slice(start + 7);
            }
          }
        }
      }
    }
  }
}
