"use strict";

const { execFileSync, spawnSync } = require("node:child_process");

const fullSha = /^[0-9a-f]{40}$/;

function hasCommit(root, commit) {
  return spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: root, stdio: "ignore" }).status === 0;
}

// Shallow CI checkouts omit history, so fetch only the pinned commit when it is absent.
function ensureCommit(root, commit) {
  if (!fullSha.test(commit)) throw new Error(`Refusing non-SHA source commit: ${commit}`);
  if (hasCommit(root, commit)) return;
  const fetched = spawnSync("git", ["fetch", "--no-tags", "--depth=1", "origin", commit], { cwd: root, encoding: "utf8" });
  if (fetched.status !== 0 || !hasCommit(root, commit)) {
    throw new Error(`Pinned source commit ${commit} is unavailable and could not be fetched from origin: ${(fetched.stderr || "").trim()}`);
  }
}

// Returns the exact bytes of a path at the pinned commit.
function showPinnedFile(root, commit, file) {
  ensureCommit(root, commit);
  return execFileSync("git", ["show", `${commit}:${file}`], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
}

module.exports = { ensureCommit, showPinnedFile };
