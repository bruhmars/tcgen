import OpenAI from "openai";

// What ANY AI provider must be able to do
export interface LLMProvider {
  name: string;
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
  forget?(systemPrompt: string, userPrompt: string): void; // optional: drop a saved answer
}

// Shared code for any AI service that copies OpenAI's format (Groq and Ollama both do)
class ChatProvider implements LLMProvider {
  name: string;
  private client: OpenAI;
  private model: string;

  constructor(name: string, baseURL: string, apiKey: string, model: string) {
    this.name = name;
    this.model = model;
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
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
      } catch (err: any) {
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

export class GroqProvider extends ChatProvider {
  constructor(apiKey: string, model = "openai/gpt-oss-120b") {
    super(`groq:${model}`, "https://api.groq.com/openai/v1", apiKey, model);
  }
}

// Optional: an AI running on your own computer (needs Ollama installed)
export class OllamaProvider extends ChatProvider {
  constructor(model: string) {
    super(`ollama:${model}`, "http://localhost:11434/v1", "ollama", model);
  }
}