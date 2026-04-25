const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFile(relativePath) {
  assert(
    fs.existsSync(path.join(root, relativePath)),
    `Missing required file: ${relativePath}`,
  );
}

function assertContains(relativePath, snippets) {
  const content = read(relativePath);
  for (const snippet of snippets) {
    assert(
      content.includes(snippet),
      `${relativePath} must include ${JSON.stringify(snippet)}`,
    );
  }
}

function assertDocumentedLinks() {
  const index = read("DOCUMENTATION_INDEX.md");
  for (const target of [
    "docs/docs-specs-ci-coverage.md",
    "docs/troubleshooting-guide.md",
    "docs/api-reference-generation.md",
  ]) {
    assert(
      index.includes(target),
      `DOCUMENTATION_INDEX.md must link ${target}`,
    );
  }
}

function assertWorkflowCoverage() {
  const workflow = read(".github/workflows/ci.yml");
  assert(
    workflow.includes("Docs/specs integration coverage"),
    ".github/workflows/ci.yml must define docs/specs integration coverage",
  );
  assert(
    workflow.includes("npm run docs:specs:check"),
    ".github/workflows/ci.yml must run npm run docs:specs:check",
  );
}

function assertPackageScript() {
  const pkg = JSON.parse(read("package.json"));
  assert(
    pkg.scripts &&
      pkg.scripts["docs:specs:check"] === "node scripts/validate_docs_specs.js",
    "package.json must define scripts.docs:specs:check",
  );
}

function assertOwnerDocs() {
  assertContains("docs/docs-specs-ci-coverage.md", [
    "# Docs and Specs CI Coverage",
    "## Owner modules/files",
    "docs/soroban-deployment.md",
    "docs/ci-cd-setup.md",
    "docs/QUICK_REFERENCE.md",
    "specs/sep41_token_total_supply.tla",
    "## Integration/e2e coverage contract",
    "npm run docs:specs:check",
    "## Stable output policy",
  ]);

  assertContains("docs/troubleshooting-guide.md", [
    "# Troubleshooting Guide",
    "## Module boundaries",
    "docs/soroban-deployment.md",
    "docs/ci-cd-setup.md",
    "docs/QUICK_REFERENCE.md",
    "## Contributor checklist",
  ]);

  assertContains("docs/api-reference-generation.md", [
    "# API Reference Generation",
    "## Canonical command",
    "cargo doc --workspace --no-deps",
    "make docs",
    "## Contribution notes",
    "## Output stability",
  ]);
}

function assertSpecCoverage() {
  const spec = read("specs/sep41_token_total_supply.tla");
  for (const symbol of [
    "SupplyInvariant",
    "TypeOK",
    "Spec ==",
    "TransferAtoB",
    "MintToA",
  ]) {
    assert(spec.includes(symbol), `SEP-41 spec must keep ${symbol} coverage`);
  }
}

for (const file of [
  "docs/docs-specs-ci-coverage.md",
  "docs/troubleshooting-guide.md",
  "docs/api-reference-generation.md",
  "docs/soroban-deployment.md",
  "docs/ci-cd-setup.md",
  "docs/QUICK_REFERENCE.md",
  "specs/sep41_token_total_supply.tla",
]) {
  assertFile(file);
}

assertPackageScript();
assertDocumentedLinks();
assertWorkflowCoverage();
assertOwnerDocs();
assertSpecCoverage();

console.log("docs/specs integration coverage passed");
