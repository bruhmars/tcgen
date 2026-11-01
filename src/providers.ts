import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { LLMProvider } from "./llm";

// Tries the first AI; if it fails, tries the next one
export class FallbackProvider implements LLMProvider {
  name = "fallback";
  private providers: LLMProvider[];

  constructor(providers: LLMProvider[]) {
    this.providers = providers;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    let lastError: any;
    for (const provider of this.providers) {
      try {
        return await provider.generate(systemPrompt, userPrompt);
      } catch (err: any) {
        lastError = err;
        console.log(`  ${provider.name} failed (${err.message}). Trying the next one...`);
      }
    }
    throw lastError;
  }
}

// Saves answers in files and reuses them.
// useSaved = false (the --fresh flag) means "ask the AI again", but valid new answers are still saved.
//
// IMPORTANT: generate() no longer auto-saves. Callers must call save() after they have
// validated the answer. This ensures bad/invalid answers are never persisted.
export class CachedProvider implements LLMProvider {
  name: string;
  private inner: LLMProvider;
  private useSaved: boolean;
  private dir = path.join(".tcgen", "cache");

  constructor(inner: LLMProvider, useSaved = true) {
    this.name = inner.name;
    this.inner = inner;
    this.useSaved = useSaved;
  }

  private fileFor(systemPrompt: string, userPrompt: string): string {
    const key = crypto
      .createHash("sha256")
      .update(this.name + "\n" + systemPrompt + "\n---\n" + userPrompt)
      .digest("hex");
    return path.join(this.dir, `${key}.txt`);
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    validate?: (answer: string) => boolean
  ): Promise<string> {
    const file = this.fileFor(systemPrompt, userPrompt);

    if (this.useSaved && fs.existsSync(file)) {
      const saved = fs.readFileSync(file, "utf-8");
      // If a validator is provided, check the saved answer before trusting it
      if (!validate || validate(saved)) {
        console.log("  (using a saved answer)");
        return saved;
      }
      // Saved answer is no good — delete it and re-fetch from the model
      console.log("  (saved answer failed validation — re-fetching from model)");
      fs.rmSync(file, { force: true });
    }

    const answer = await this.inner.generate(systemPrompt, userPrompt);
    // NOTE: we deliberately do NOT save here. The caller must call save() after validation.
    return answer;
  }

  /** Persist an answer that has already been validated by the caller. */
  save(systemPrompt: string, userPrompt: string, answer: string): void {
    if (!answer) return;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.fileFor(systemPrompt, userPrompt), answer);
  }

  /** Called when a saved answer turned out to be bad — removes it from disk. */
  forget(systemPrompt: string, userPrompt: string): void {
    fs.rmSync(this.fileFor(systemPrompt, userPrompt), { force: true });
  }
}
