const MAX_CHARS = 12000;
const MAX_FILES = 3;
const $ = (id) => document.getElementById(id);

// Elements
const codeBox = $("code");
const countEl = $("count");
const goBtn = $("go");
const repoInput = $("repo-url");
const scanBtn = $("scan");
const repoGo = $("repo-go");
const repoFiles = $("repo-files");
const repoCount = $("repo-count");
const output = $("output");

const apiMethod = $("api-method");
const apiEndpoint = $("api-endpoint");
const apiPayload = $("api-payload");
const apiContext = $("api-context");
const apiGo = $("api-go");

const reqTitle = $("req-title");
const reqText = $("req-text");
const reqGo = $("req-go");

const exportActions = $("export-actions");
const btnExportExcel = $("btn-export-excel");
const btnExportCsv = $("btn-export-csv");
const btnExportMd = $("btn-export-md");

let busy = null;
let currentMode = "paste";
let loadingTimer = null;
let scannedUrl = "";
const selected = new Set();
let lastExportData = null; // { type: "api" | "requirement", data: ... }

// Examples for different modes
const EXAMPLES = {
  paste: `/** Applies a percentage discount to a price. Throws if percent is not between 0 and 100. */
export function applyDiscount(price: number, percent: number): number {
  if (percent < 0 || percent > 100) {
    throw new Error("Invalid discount");
  }
  return price - (price * percent) / 100;
}

/** Returns true if the text reads the same forwards and backwards, ignoring case and punctuation. */
export function isPalindrome(text: string): boolean {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === cleaned.split("").reverse().join("");
}`,
  api: {
    method: "POST",
    endpoint: "/api/v1/auth/register",
    payload: JSON.stringify(
      {
        username: "johndoe",
        email: "john@example.com",
        password: "SecurePassword123!",
        age: 28,
      },
      null,
      2
    ),
    context: "Username must be 3-20 chars. Password must contain uppercase, number, symbol. Rate limit 5 requests/min.",
  },
  req: {
    title: "E-Commerce Checkout & Coupon System",
    text: `- User can review items in the shopping cart and proceed to checkout.
- Cart cannot be empty when initiating checkout (triggers 400 validation error).
- User can input a promotional discount coupon:
  * Percentage discount (e.g. SAVE20 gives 20% off)
  * Flat discount (e.g. FLAT10 gives $10 off)
  * Expired or invalid coupons must display an error banner and not change total.
- User can pay with Stripe (credit card) or PayPal.
- If Stripe declines the card, display exact rejection message and allow retry without losing cart items.
- On successful payment, create order in database, deduct inventory, and send email receipt.`,
  },
};

// Helpers
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function show(...nodes) {
  output.replaceChildren(...nodes);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `The request failed (${response.status}).`);
  return data;
}

async function downloadExport(format) {
  if (!lastExportData) return;
  const endpoint = `/api/export/${format}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastExportData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Export failed (${res.status})`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match ? match[1] : `test_plan.${format === "excel" ? "xlsx" : format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Export error: ${err.message}`);
  }
}

function makeCopyButton(text) {
  const btn = el("button", "ghost", "Copy");
  btn.type = "button";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied!";
    } catch {
      btn.textContent = "Press Ctrl+C";
    }
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
  return btn;
}

function makeDownloadButton(text, filename) {
  const btn = el("button", "ghost", "Download");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  return btn;
}

function refreshButtons() {
  const n = codeBox.value.length;
  countEl.textContent = `${n} / ${MAX_CHARS}`;
  countEl.classList.toggle("over", n > MAX_CHARS);

  goBtn.disabled = busy !== null || n === 0 || n > MAX_CHARS;
  scanBtn.disabled = busy !== null;
  repoGo.disabled = busy !== null || selected.size === 0;
  apiGo.disabled = busy !== null || !apiEndpoint.value.trim();
  reqGo.disabled = busy !== null || !reqText.value.trim();

  goBtn.textContent = busy === "paste" ? "Generating..." : "Generate tests";
  scanBtn.textContent = busy === "scan" ? "Scanning..." : "Scan";
  repoGo.textContent = busy === "repo" ? "Generating..." : "Generate tests";
  apiGo.textContent = busy === "api" ? "Generating..." : "Generate API Tests";
  reqGo.textContent = busy === "req" ? "Generating..." : "Generate PRD Tests";
}

function updateRepoCount() {
  repoCount.textContent =
    selected.size === 0 ? "Pick up to 3 files" : `${selected.size} of ${MAX_FILES} files selected`;
}

function showEmpty(title, text) {
  exportActions.hidden = true;
  const box = el("div", "empty");
  box.append(el("strong", "", title), el("span", "", text));
  show(box);
}

function showLoading(messages) {
  exportActions.hidden = true;
  const box = el("div", "loading");
  const message = el("p", "", messages[0]);
  box.append(el("div", "spinner"), message);
  show(box);

  let i = 0;
  loadingTimer = setInterval(() => {
    i = (i + 1) % messages.length;
    message.textContent = messages[i];
  }, 3500);
}

function stopLoading() {
  clearInterval(loadingTimer);
  loadingTimer = null;
}

function showError(message) {
  exportActions.hidden = true;
  show(el("div", "error", message));
}

// Result Renderers
function showPasteResult(data) {
  exportActions.hidden = true;
  const stats = el("div", "stats");
  stats.append(
    el("span", "chip", plural(data.functions.length, "function")),
    el("span", "chip", plural(data.testCount, "test"))
  );
  for (const category of ["happy", "edge", "negative"]) {
    const n = data.cases.filter((c) => c.category === category).length;
    if (n > 0) stats.append(el("span", `badge ${category}`, `${n} ${category}`));
  }

  const nodes = [stats];
  if (data.skipped > 0) {
    nodes.push(el("div", "hint", `Skipped ${plural(data.skipped, "function")}.`));
  }

  const actions = el("div", "export-actions");
  actions.append(
    makeCopyButton(data.testCode),
    makeDownloadButton(data.testCode, "generated.test.ts")
  );

  const pre = el("pre");
  pre.append(el("code", "", data.testCode));

  nodes.push(actions, pre);
  show(...nodes);
}

function showApiResult(data) {
  lastExportData = { type: "api", data };
  exportActions.hidden = false;

  const stats = el("div", "stats");
  stats.append(
    el("span", "chip", `${data.method} ${data.endpoint}`),
    el("span", "chip", plural(data.testCases.length, "test case"))
  );

  for (const cat of ["happy", "edge", "negative"]) {
    const n = data.testCases.filter((c) => c.category === cat).length;
    if (n > 0) stats.append(el("span", `badge ${cat}`, `${n} ${cat}`));
  }

  const list = el("ul", "cases");
  for (const tc of data.testCases) {
    const card = el("li", "case");
    const top = el("div", "case-top");
    top.append(
      el("span", `badge ${tc.category}`, tc.category),
      el("span", "chip", `Status ${tc.expectedStatus}`),
      el("span", "case-name", `${tc.id || "API"}: ${tc.name}`)
    );

    const stepsText = tc.steps.map((s, idx) => `Step ${idx + 1}: ${s}`).join("\n");
    const resultsText = tc.expectedResults.map((r) => `✓ Expected: ${r}`).join("\n");

    const preSteps = el("pre", "", `${stepsText}\n\n${resultsText}`);
    card.append(top, preSteps);
    list.append(card);
  }

  show(stats, list);
}

function showReqResult(data) {
  lastExportData = { type: "requirement", data };
  exportActions.hidden = false;

  const stats = el("div", "stats");
  stats.append(
    el("span", "chip", data.title || "Requirements"),
    el("span", "chip", plural(data.testCases.length, "test case")),
    el("span", "chip", plural(data.traceabilityMatrix.length, "matrix item"))
  );

  for (const p of ["P0", "P1", "P2", "P3"]) {
    const n = data.testCases.filter((c) => c.priority === p).length;
    if (n > 0) stats.append(el("span", `badge ${p}`, `${n} ${p}`));
  }

  // Traceability Matrix Table
  const tableWrap = el("div", "table-wrap");
  const table = el("table");
  const thead = el("thead");
  thead.innerHTML = `<tr>
    <th>Req ID</th>
    <th>Module</th>
    <th>Requirement Description</th>
    <th>Test Point</th>
    <th>Linked Cases</th>
  </tr>`;
  const tbody = el("tbody");

  for (const tm of data.traceabilityMatrix) {
    const tr = el("tr");
    tr.innerHTML = `<td><strong>${tm.reqId}</strong></td>
      <td>${tm.module}</td>
      <td>${tm.reqDescription}</td>
      <td>${tm.testPoint}</td>
      <td><code>${tm.testCaseIds.join(", ") || "-"}</code></td>`;
    tbody.append(tr);
  }
  table.append(thead, tbody);
  tableWrap.append(table);

  // Test Case Cards
  const list = el("ul", "cases");
  for (const tc of data.testCases) {
    const card = el("li", "case");
    const top = el("div", "case-top");
    top.append(
      el("span", `badge ${tc.priority}`, tc.priority),
      el("span", `badge ${tc.category}`, tc.category),
      el("span", "chip", tc.reqId),
      el("span", "case-name", `${tc.id}: ${tc.name}`)
    );

    const stepsText = tc.steps.map((s, idx) => `Step ${idx + 1}: ${s}`).join("\n");
    const resultsText = tc.expectedResults.map((r) => `✓ Expected: ${r}`).join("\n");

    const pre = el("pre", "", `${stepsText}\n\n${resultsText}`);
    card.append(top, pre);
    list.append(card);
  }

  show(stats, el("h3", "", "Requirements Traceability Matrix (RTM)"), tableWrap, el("h3", "", "Prioritized Test Cases"), list);
}

function showRepoResult(data) {
  exportActions.hidden = true;
  const stats = el("div", "stats");
  stats.append(
    el("span", "chip", plural(data.files.length, "test file")),
    el("span", "chip", plural(data.testCount, "test"))
  );

  const nodes = [stats];
  for (const f of data.files) {
    const card = el("div", "case");
    const top = el("div", "case-top");
    top.append(el("strong", "", `${f.path} -> ${f.testPath}`));
    top.append(makeCopyButton(f.testCode));
    const pre = el("pre", "", f.testCode);
    card.append(top, pre);
    nodes.push(card);
  }
  show(...nodes);
}

function renderFileList(data) {
  const wrap = el("div");
  const meta = el("div", "hint");
  meta.textContent = `${plural(data.totalCandidates, "source file")} found in ${data.repo}`;
  wrap.append(meta);

  const rows = el("div");
  for (const f of data.candidates) {
    const row = el("label", "case-top");
    const box = el("input");
    box.type = "checkbox";
    box.addEventListener("change", () => {
      if (box.checked) {
        if (selected.size >= MAX_FILES) {
          box.checked = false;
          repoCount.textContent = `You can pick up to ${MAX_FILES} files.`;
          return;
        }
        selected.add(f.path);
      } else {
        selected.delete(f.path);
      }
      updateRepoCount();
      refreshButtons();
    });
    row.append(box, el("code", "", f.path), el("span", "hint-small", `${(f.size / 1024).toFixed(1)} KB`));
    rows.append(row);
  }
  wrap.append(rows);
  repoFiles.replaceChildren(wrap);
}

// Handlers
async function generatePaste() {
  const code = codeBox.value.trim();
  if (!code) return showError("Paste some code first.");

  busy = "paste";
  refreshButtons();
  showLoading(["Analyzing functions...", "Extracting branch AST...", "Generating Vitest test cases..."]);

  try {
    const data = await post("/api/generate", { code });
    stopLoading();
    showPasteResult(data);
  } catch (err) {
    stopLoading();
    showError(err.message);
  } finally {
    busy = null;
    refreshButtons();
  }
}

async function scanRepo() {
  const url = repoInput.value.trim();
  if (!url) return showError("Enter a GitHub repository URL.");

  busy = "scan";
  refreshButtons();
  showLoading(["Scanning repository tree from GitHub...", "Filtering testable source files..."]);

  try {
    const data = await post("/api/repo/scan", { url });
    stopLoading();
    scannedUrl = url;
    selected.clear();
    renderFileList(data);
    updateRepoCount();
    showEmpty("Pick files to test", "Select up to 3 files and click Generate tests.");
  } catch (err) {
    stopLoading();
    showError(err.message);
  } finally {
    busy = null;
    refreshButtons();
  }
}

async function generateRepo() {
  busy = "repo";
  refreshButtons();
  showLoading(["Fetching files...", "Parsing AST & generating unit test suites..."]);

  try {
    const data = await post("/api/repo/generate", { url: scannedUrl, paths: [...selected] });
    stopLoading();
    showRepoResult(data);
  } catch (err) {
    stopLoading();
    showError(err.message);
  } finally {
    busy = null;
    refreshButtons();
  }
}

async function generateApi() {
  const endpoint = apiEndpoint.value.trim();
  if (!endpoint) return showError("Endpoint route is required.");

  busy = "api";
  refreshButtons();
  showLoading([
    "Designing positive & happy path cases...",
    "Computing Boundary Value Analysis (BVA)...",
    "Designing negative validation & security injection tests...",
  ]);

  let payload = undefined;
  if (apiPayload.value.trim()) {
    try {
      payload = JSON.parse(apiPayload.value.trim());
    } catch {
      payload = apiPayload.value.trim();
    }
  }

  try {
    const data = await post("/api/api-tests", {
      endpoint,
      method: apiMethod.value,
      payload,
      extraContext: apiContext.value.trim() || undefined,
    });
    stopLoading();
    showApiResult(data);
  } catch (err) {
    stopLoading();
    showError(err.message);
  } finally {
    busy = null;
    refreshButtons();
  }
}

async function generateReq() {
  const requirementText = reqText.value.trim();
  if (!requirementText) return showError("Requirement text is required.");

  busy = "req";
  refreshButtons();
  showLoading([
    "Deconstructing requirements into functional modules...",
    "Building Requirements Traceability Matrix (RTM)...",
    "Assigning P0-P3 priorities and designing step assertions...",
  ]);

  try {
    const data = await post("/api/requirement-tests", {
      title: reqTitle.value.trim() || "Feature Test Plan",
      requirementText,
    });
    stopLoading();
    showReqResult(data);
  } catch (err) {
    stopLoading();
    showError(err.message);
  } finally {
    busy = null;
    refreshButtons();
  }
}

function setMode(mode) {
  currentMode = mode;
  $("paste-body").hidden = mode !== "paste";
  $("repo-body").hidden = mode !== "repo";
  $("api-body").hidden = mode !== "api";
  $("req-body").hidden = mode !== "req";

  $("mode-paste").classList.toggle("active", mode === "paste");
  $("mode-repo").classList.toggle("active", mode === "repo");
  $("mode-api").classList.toggle("active", mode === "api");
  $("mode-req").classList.toggle("active", mode === "req");

  if (mode === "paste") {
    showEmpty("Unit test suite generator", "Paste functions on the left or load an example, then click Generate tests.");
  } else if (mode === "repo") {
    showEmpty("Test a GitHub repository", "Enter a GitHub repo URL, click Scan, and select the files you want to generate tests for.");
  } else if (mode === "api") {
    showEmpty("API test plan designer", "Provide endpoint, method, and request payload to generate comprehensive positive, negative, boundary, and security test cases.");
  } else if (mode === "req") {
    showEmpty("Requirement & PRD test suite designer", "Paste user stories or acceptance criteria to generate a Requirements Traceability Matrix (RTM) with P0-P3 prioritized tests.");
  }
  refreshButtons();
}

function loadSample() {
  if (currentMode === "paste") {
    codeBox.value = EXAMPLES.paste;
  } else if (currentMode === "api") {
    apiMethod.value = EXAMPLES.api.method;
    apiEndpoint.value = EXAMPLES.api.endpoint;
    apiPayload.value = EXAMPLES.api.payload;
    apiContext.value = EXAMPLES.api.context;
  } else if (currentMode === "req") {
    reqTitle.value = EXAMPLES.req.title;
    reqText.value = EXAMPLES.req.text;
  } else if (currentMode === "repo") {
    repoInput.value = "https://github.com/bruhmars/ezpost";
  }
  refreshButtons();
}

// Listeners
$("mode-paste").addEventListener("click", () => setMode("paste"));
$("mode-repo").addEventListener("click", () => setMode("repo"));
$("mode-api").addEventListener("click", () => setMode("api"));
$("mode-req").addEventListener("click", () => setMode("req"));
$("sample").addEventListener("click", loadSample);

codeBox.addEventListener("input", refreshButtons);
apiEndpoint.addEventListener("input", refreshButtons);
reqText.addEventListener("input", refreshButtons);

goBtn.addEventListener("click", generatePaste);
scanBtn.addEventListener("click", scanRepo);
repoGo.addEventListener("click", generateRepo);
apiGo.addEventListener("click", generateApi);
reqGo.addEventListener("click", generateReq);

btnExportExcel.addEventListener("click", () => downloadExport("excel"));
btnExportCsv.addEventListener("click", () => downloadExport("csv"));
btnExportMd.addEventListener("click", () => downloadExport("markdown"));

setMode("paste");
refreshButtons();
