import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function findWebmFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) {
        results.push(...findWebmFiles(full));
      } else if (entry.endsWith(".webm")) {
        results.push(full);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return results;
}

export default function globalTeardown() {
  const testResultsDir = join(import.meta.dirname, "..", "test-results");
  const webmFiles = findWebmFiles(testResultsDir);

  for (const webm of webmFiles) {
    const mp4 = webm.replace(/\.webm$/, ".mp4");
    try {
      execSync(
        `ffmpeg -y -i "${webm}" -c:v libx264 -preset fast -crf 23 "${mp4}"`,
        { stdio: "ignore" },
      );
      console.log(`Converted: ${webm} -> ${mp4}`);
    } catch {
      console.error(`Failed to convert: ${webm}`);
    }
  }
}
