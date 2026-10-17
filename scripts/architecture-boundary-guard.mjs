import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve("src");
const applicationModuleRoot = path.join(sourceRoot, "modules");
const bootstrapPath = path.join(sourceRoot, "bootstrap", "workspaceRuntime.ts");
const allowedCoreModuleSources = new Set([
  "../panels/corePanels",
  "../panels/demoModule",
  "../modules/workspace-diagnostics",
]);
const workspaceDiagnosticsModuleRoot = path.resolve(
  applicationModuleRoot,
  "workspace-diagnostics",
);

function collectProductionSources(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectProductionSources(absolutePath);
    if (
      !entry.isFile() ||
      !/\.[cm]?[jt]sx?$/.test(entry.name) ||
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)
    ) {
      return [];
    }
    return [absolutePath];
  });
}

function importedSpecifiers(source) {
  const specifiers = [];
  const matcher = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
  for (const match of source.matchAll(matcher)) specifiers.push(match[1]);
  return specifiers;
}

function isApplicationModuleImport(importerPath, specifier) {
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const importerRelative = path.relative(workspaceDiagnosticsModuleRoot, importerPath);
  const importerIsDiagnostics = importerRelative === "" ||
    (!importerRelative.startsWith("..") && !path.isAbsolute(importerRelative));
  if (!specifier.startsWith(".")) {
    return /(?:^|\/)modules(?:\/|$)/.test(normalizedSpecifier);
  }

  const resolved = path.resolve(path.dirname(importerPath), specifier);
  const relativeToModules = path.relative(applicationModuleRoot, resolved);
  const resolvesToModule = relativeToModules === "" ||
    (!relativeToModules.startsWith("..") && !path.isAbsolute(relativeToModules));
  if (!resolvesToModule) return false;
  if (importerIsDiagnostics) {
    const relativeToDiagnostics = path.relative(workspaceDiagnosticsModuleRoot, resolved);
    const remainsInDiagnostics = relativeToDiagnostics === "" ||
      (!relativeToDiagnostics.startsWith("..") && !path.isAbsolute(relativeToDiagnostics));
    return !remainsInDiagnostics;
  }
  return true;
}

const applicationSources = collectProductionSources(applicationModuleRoot).filter(
  (file) => {
    const relative = path.relative(workspaceDiagnosticsModuleRoot, file);
    return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  },
);
assert.equal(
  applicationSources.length,
  0,
  `Core may contain only its explicit first-party Workspace Diagnostics module under src/modules:\n${applicationSources
    .map((file) => `  - ${path.relative(process.cwd(), file)}`)
    .join("\n")}`,
);

const sourceFiles = collectProductionSources(workspaceDiagnosticsModuleRoot);
const forbiddenImports = [];
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  for (const specifier of importedSpecifiers(source)) {
    if (isApplicationModuleImport(file, specifier)) {
      forbiddenImports.push(
        `${path.relative(process.cwd(), file)} imports application module '${specifier}'`,
      );
    }
  }
}
assert.deepEqual(forbiddenImports, [], forbiddenImports.join("\n"));

const bootstrap = readFileSync(bootstrapPath, "utf8");
assert.doesNotMatch(
  bootstrap,
  /\bcontributors\s*:|\.registerModule\s*\(/,
  "Core bootstrap does not add application modules through runtime contributors",
);
const importsByBinding = new Map();
const importMatcher = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
for (const match of bootstrap.matchAll(importMatcher)) {
  const source = match[2];
  for (const entry of match[1].split(",")) {
    const binding = entry.trim().split(/\s+as\s+/).at(-1)?.trim();
    if (binding) importsByBinding.set(binding, source);
  }
}

const moduleRegistration = bootstrap.match(/modules\s*:\s*\[([^\]]*)\]/s);
assert.ok(moduleRegistration, "Workspace runtime bootstrap keeps an explicit module list");
const registeredBindings = moduleRegistration[1]
  .split(",")
  .map((binding) => binding.trim())
  .filter(Boolean);
assert.ok(registeredBindings.length > 0, "Core registers its framework/demo modules");

for (const binding of registeredBindings) {
  const source = importsByBinding.get(binding);
  assert.ok(source, `Registered module '${binding}' must have a direct import`);
  assert.ok(
    allowedCoreModuleSources.has(source),
    `Registered module '${binding}' must come from a framework-owned source; got '${source}'`,
  );
}

console.log("Core application boundary guard passed");
