"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedProvider = exports.FallbackProvider = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// Tries the first AI; if it fails, tries the next one
class FallbackProvider {
    name = "fallback";
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    async generate(systemPrompt, userPrompt) {
        let lastError;
        for (const provider of this.providers) {
            try {
                return await provider.generate(systemPrompt, userPrompt);
            }
            catch (err) {
                lastError = err;
                console.log(`  ${provider.name} failed (${err.message}). Trying the next one...`);
            }
        }
        throw lastError;
    }
}
exports.FallbackProvider = FallbackProvider;
// Saves answers in files and reuses them.
// useSaved = false (the --fresh flag) means "ask the AI again", but new answers are still saved.
class CachedProvider {
    name;
    inner;
    useSaved;
    dir = node_path_1.default.join(".tcgen", "cache");
    constructor(inner, useSaved = true) {
        this.name = inner.name;
        this.inner = inner;
        this.useSaved = useSaved;
    }
    fileFor(systemPrompt, userPrompt) {
        const key = node_crypto_1.default
            .createHash("sha256")
            .update(this.name + "\n" + systemPrompt + "\n---\n" + userPrompt)
            .digest("hex");
        return node_path_1.default.join(this.dir, `${key}.txt`);
    }
    async generate(systemPrompt, userPrompt) {
        const file = this.fileFor(systemPrompt, userPrompt);
        if (this.useSaved && node_fs_1.default.existsSync(file)) {
            console.log("  (using a saved answer)");
            return node_fs_1.default.readFileSync(file, "utf-8");
        }
        const answer = await this.inner.generate(systemPrompt, userPrompt);
        if (answer) {
            node_fs_1.default.mkdirSync(this.dir, { recursive: true });
            node_fs_1.default.writeFileSync(file, answer);
        }
        return answer;
    }
    // Called when a saved answer turned out to be bad
    forget(systemPrompt, userPrompt) {
        node_fs_1.default.rmSync(this.fileFor(systemPrompt, userPrompt), { force: true });
    }
}
exports.CachedProvider = CachedProvider;
