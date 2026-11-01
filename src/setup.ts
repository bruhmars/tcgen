import "dotenv/config";
import { GroqProvider, OllamaProvider } from "./llm";
import type { LLMProvider } from "./llm";
import { CachedProvider, FallbackProvider } from "./providers";

export function buildProvider(fresh = false, useCache = true): LLMProvider {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing. Check your .env file.");

  const list: LLMProvider[] = [
    new GroqProvider(apiKey, "openai/gpt-oss-120b"),
    new GroqProvider(apiKey, "openai/gpt-oss-20b"),
  ];

  if (process.env.OLLAMA_MODEL) {
    list.push(new OllamaProvider(process.env.OLLAMA_MODEL));
  }

  const fallback = new FallbackProvider(list);
  if (!useCache) {
    return fallback;
  }
  return new CachedProvider(fallback, !fresh);
}
