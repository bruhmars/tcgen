"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = exports.GroqProvider = void 0;
const openai_1 = __importDefault(require("openai"));
// Shared code for any AI service that copies OpenAI's format (Groq and Ollama both do)
class ChatProvider {
    name;
    client;
    model;
    constructor(name, baseURL, apiKey, model) {
        this.name = name;
        this.model = model;
        this.client = new openai_1.default({ apiKey, baseURL });
    }
    async generate(systemPrompt, userPrompt) {
        const maxTries = 3;
        for (let attempt = 1; attempt <= maxTries; attempt++) {
            try {
                const response = await this.client.chat.completions.create({
                    model: this.model,
                    temperature: 0.2,
                    max_completion_tokens: 8000,
                    reasoning_effort: "low",
                    messages: [
                        { role: "system", content: systemPrompt + " Do not call any tools. Reply with text only." },
                        { role: "user", content: userPrompt },
                    ],
                });
                return response.choices[0]?.message?.content ?? "";
            }
            catch (err) {
                const message = String(err?.message ?? err);
                const isTemporary = err?.status === 429 || message.includes("called a tool");
                if (isTemporary && attempt < maxTries) {
                    console.log(`  ${this.name}: temporary problem, trying again (${attempt}/${maxTries - 1})...`);
                    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
                    continue;
                }
                throw err;
            }
        }
        return "";
    }
}
class GroqProvider extends ChatProvider {
    constructor(apiKey, model = "openai/gpt-oss-120b") {
        super(`groq:${model}`, "https://api.groq.com/openai/v1", apiKey, model);
    }
}
exports.GroqProvider = GroqProvider;
// Optional: an AI running on your own computer (needs Ollama installed)
class OllamaProvider extends ChatProvider {
    constructor(model) {
        super(`ollama:${model}`, "http://localhost:11434/v1", "ollama", model);
    }
}
exports.OllamaProvider = OllamaProvider;
