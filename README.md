# 🧪 TestGen 2.0: AI-Powered Multi-Domain Test Case Generator & MCP Server

An end-to-end, multi-domain AI test generation engine and Model Context Protocol (MCP) server. Generates executable **Vitest unit tests**, exhaustive **REST API test plans** (positive, negative, boundary, security), and complete **Requirements Traceability Matrices (RTM)** from PRDs and user stories with P0–P3 priority tagging and styled Excel export.

---

## 🔍 Reverse Engineered Architecture: How AI Test Case Generators Work Under the Hood

By reverse engineering **[ai-testcase-generator-mcp](https://github.com/Mallikarjun-Roddannavar/ai-testcase-generator-mcp)**, **[testcase-generator-mcp](https://github.com/EmptyRabbit/testcase-generator-mcp)**, and **[ai-testcase-generator](https://github.com/rajeshbakthavachalam/ai-testcase-generator)**, we synthesized the fundamental pillars of production-grade AI test design engines:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Test Generation Inputs                 │
                  ├───────────────────┬───────────────────┬────────────────┤
                  │ 1. AST Code       │ 2. API Endpoints  │ 3. PRDs / Specs│
                  │ (TS/JS Functions) │ (Method, Body, URI│ (User Stories) │
                  └─────────┬─────────┴─────────┬─────────┴────────┬───────┘
                            │                   │                  │
                            ▼                   ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AI Reasoning & Prompt Engine                             │
│  - AST Branch Extraction: if/else, ternaries, throws, boundary values                    │
│  - Partitioning: Happy Path, Equivalence Classes, Boundary Value Analysis (BVA)          │
│  - Security & Robustness: 401/403 Auth, SQLi/XSS fuzzing, malformed payloads             │
│  - Requirements Traceability Matrix (RTM): Req ID -> Module -> Test Point -> Case ID     │
│  - Priority Classification: P0 (Smoke/Blocker), P1 (Critical), P2 (Medium), P3 (Low)     │
└───────────────────────────────────────────┬──────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              Robust Output Sanitizer & Validator                         │
│  - JSON boundary detection & Markdown fence stripping                                    │
│  - Token normalization: unquoted undefined -> null, NaN coercion, trailing comma repair │
│  - Zod Schema validation: strict runtime type assertion & fallback recovery              │
└───────────────────────────────────────────┬──────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                               Multi-Channel Delivery & Execution                         │
│  ┌─────────────────────────┬─────────────────────────┬────────────────────────────────┐  │
│  │ 1. Self-Healing Vitest  │ 2. Model Context        │ 3. Multi-Format Export         │  │
│  │    Subprocess Runner &  │    Protocol (MCP Server)│    - Styled Excel (.xlsx)      │  │
│  │    AI Repair Loop       │    - stdio Transport    │    - RFC-4180 CSV              │  │
│  │                         │    - Claude / Cursor    │    - Hierarchical Markdown     │  │
│  └─────────────────────────┴─────────────────────────┴────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Engineering Takeaways:
1. **Partitioning & BVA Strategy** (*from Mallikarjun*):
   - Rather than asking for generic tests, instruct the model with explicit categories: `happy` (200/201), `edge` (BVA off-by-one, 0, null, empty strings, max integer/length bounds), and `negative` (400/422 validation, 401/403 authorization, injection patterns).
2. **Requirements Traceability & Priority Tagging** (*from EmptyRabbit*):
   - Map each requirement to a deterministic requirement ID (`REQ-001`) and test cases to IDs (`TC0001`).
   - Group by Module and Submodule in an RTM table to guarantee zero blind spots.
   - Enforce industry-standard priority tiers (`P0`, `P1`, `P2`, `P3`).
3. **Execution, Validation & Self-Healing Repair** (*from tcgen pipeline*):
   - Generates executable test files (`render.ts`), executes them inside Vitest (`runner.ts`), intercepts failure stack traces, and performs diagnosis (`repair.ts`) to fix incorrect test assumptions or pinpoint code defects.
4. **Structured Multi-Format Output** (*from Mallikarjun & Rajesh*):
   - Automatic generation of stylized Excel workbooks with colored headers, auto-calculated column widths, word wrapping, and zebra striping.

---

## 🚀 Features

- **AST-Driven Unit Test Generation**: Analyzes JavaScript/TypeScript AST with `ts-morph` to identify all branch conditions, ternaries, and exceptions.
- **REST API Test Plan Designer**: Generates positive, negative, boundary, and security test plans from endpoint routes and request payloads.
- **PRD & User Story Test Designer**: Generates full Requirements Traceability Matrices (RTM) and P0–P3 prioritized test cases.
- **Self-Healing Execution Engine**: Runs tests with Vitest in a sandbox subprocess, diagnoses failures, and automatically heals them.
- **Model Context Protocol (MCP) Server**: Exposes standard tools via stdio to Claude Desktop, Cursor, and Antigravity.
- **Multi-Format Export**: One-click download of test plans in **Excel (.xlsx)**, **CSV**, **Markdown**, and **XMind-compatible JSON**.
- **Modern Responsive Web UI**: Tabbed interface with dark-mode aesthetic.

---

## 📦 Getting Started

### 1. Installation

```bash
git clone https://github.com/bruhmars/tcgen.git
cd tcgen
npm install
npm run build
```

### 2. Environment Configuration

Create or update `.env`:
```env
GROQ_API_KEY=your_groq_api_key
GITHUB_TOKEN=your_optional_github_token
PORT=3000
```

---

## 🛠️ Usage

### A. Run the Web Application
```bash
npm start
# Open http://localhost:3000 in your browser
```

### B. Run as an MCP Server (Claude Desktop / Cursor / Antigravity)
Add this to your MCP configuration (`claude_desktop_config.json` or `.gemini/antigravity-cli/mcp/`):

```json
{
  "mcpServers": {
    "tcgen": {
      "command": "node",
      "args": ["/home/ojeswi/tcgen/bin/mcp.js"],
      "env": {
        "GROQ_API_KEY": "your_groq_api_key"
      }
    }
  }
}
```

#### Available MCP Tools:
- `generate_unit_tests`: Generate runnable Vitest suites from TS/JS functions.
- `generate_api_tests`: Generate comprehensive API endpoint test plans.
- `generate_requirement_tests`: Generate RTM and P0-P3 test suites from PRD specs.
- `run_and_repair_tests`: Execute Vitest in background and self-heal failing assertions.

### C. Run the CLI Pipeline
```bash
npx tsx src/cli.ts samples/applyDiscount.ts
npx tsx src/cli.ts samples/isPalindrome.ts
```

### D. Run Vitest Unit Tests
```bash
npm test
```
