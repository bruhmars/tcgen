"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoError = void 0;
exports.parseRepoUrl = parseRepoUrl;
exports.fetchGitHubJson = fetchGitHubJson;
exports.fetchGitHubRawFile = fetchGitHubRawFile;
require("dotenv/config");
class RepoError extends Error {
    constructor(message) {
        super(message);
        this.name = "RepoError";
    }
}
exports.RepoError = RepoError;
function parseRepoUrl(url) {
    if (!url || typeof url !== "string") {
        throw new RepoError("Please provide a valid GitHub repository URL.");
    }
    const cleaned = url.trim().replace(/\/+$/, "");
    const match = cleaned.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
    if (!match) {
        throw new RepoError("Invalid GitHub URL format. Example: https://github.com/owner/repo");
    }
    const owner = match[1];
    let repo = match[2];
    if (repo.endsWith(".git")) {
        repo = repo.slice(0, -4);
    }
    return { owner, repo };
}
async function fetchGitHubJson(path) {
    const token = process.env.GITHUB_TOKEN;
    const headers = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "tcgen-testcase-generator",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
    const resp = await fetch(url, { headers });
    if (resp.status === 404) {
        throw new RepoError("Repository or file not found. Ensure it is public or your token has access.");
    }
    if (resp.status === 403 || resp.status === 429) {
        throw new RepoError("GitHub API rate limit exceeded. Please try again later or configure GITHUB_TOKEN.");
    }
    if (!resp.ok) {
        throw new RepoError(`GitHub API error (${resp.status}): ${resp.statusText}`);
    }
    return resp.json();
}
async function fetchGitHubRawFile(owner, repo, path, branch = "main") {
    const token = process.env.GITHUB_TOKEN;
    const headers = {
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": "tcgen-testcase-generator",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    let resp = await fetch(url, { headers });
    if (!resp.ok && branch === "main") {
        // Try master branch as fallback
        const fallbackUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}`;
        resp = await fetch(fallbackUrl, { headers });
    }
    if (!resp.ok) {
        throw new RepoError(`Could not fetch file contents for ${path}`);
    }
    return resp.text();
}
