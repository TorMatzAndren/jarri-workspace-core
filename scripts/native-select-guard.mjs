import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(process.cwd(), "src");
const nativeSelectPattern = /<\/?(select|option)\b/;
const violations = [];

function scanDirectory(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      scanDirectory(path);
      continue;
    }

    if (!stat.isFile() || !path.endsWith(".tsx")) {
      continue;
    }

    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (nativeSelectPattern.test(line)) {
        violations.push(
          `${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`,
        );
      }
    });
  }
}

scanDirectory(sourceRoot);

if (violations.length > 0) {
  console.error("Native select controls are not allowed under src/**/*.tsx:");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("native select guard passed");
