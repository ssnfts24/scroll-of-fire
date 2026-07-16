"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docsRoot = path.join(root, "docs");
const theoryRoot = path.join(docsRoot, "theory");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function hrefs(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
}

function localHrefTargets(fileRelativePath) {
  const html = read(fileRelativePath);
  return hrefs(html)
    .filter(href => !href.startsWith("#"))
    .filter(href => !/^(?:https?:|mailto:|tel:|data:|javascript:)/.test(href));
}

test("theory subpages use resolvable site-root links", () => {
  for (const entry of fs.readdirSync(theoryRoot)) {
    if (!entry.endsWith(".html")) continue;
    const relativePath = path.posix.join("docs", "theory", entry);
    for (const href of localHrefTargets(relativePath)) {
      const targetPath = href.split("#", 1)[0].split("?", 1)[0];
      assert.ok(targetPath, `${relativePath} contains an empty href target`);
      const absoluteTarget = path.join(docsRoot, targetPath);
      assert.ok(fs.existsSync(absoluteTarget), `${relativePath} -> ${href} is missing`);
    }
  }
});

test("theory hub operator cards point to live anchors", () => {
  const operators = read("docs/theory/operators.html");
  for (const anchor of ["intention", "language", "coherence", "source"]) {
    assert.match(operators, new RegExp(`id=\"${anchor}\"`), `operators page missing #${anchor}`);
  }
});
