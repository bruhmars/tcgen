"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProvider = buildProvider;
require("dotenv/config");
const llm_1 = require("./llm");
const providers_1 = require("./providers");
function buildProvider(fresh = false, useCache = true) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey)
        throw new Error("GROQ_API_KEY is missing. Check your .env file.");
    const list = [
        new llm_1.GroqProvider(apiKey, "openai/gpt-oss-120b"),
        new llm_1.GroqProvider(apiKey, "openai/gpt-oss-20b"),
    ];
    if (process.env.OLLAMA_MODEL) {
        list.push(new llm_1.OllamaProvider(process.env.OLLAMA_MODEL));
    }
    const fallback = new providers_1.FallbackProvider(list);
    if (!useCache) {
        return fallback;
    }
    return new providers_1.CachedProvider(fallback, !fresh);
}
