import { test } from "@playwright/test";
import * as fs from "fs";

const PDF_PATH = "/Users/bulldra/Downloads/oreilly-978-4-8144-0108-6e.pdf";

test("本文ページのレンダリング確認", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const input = page.locator('input[type="file"]');
  await input.setInputFiles(PDF_PATH);
  await page.locator("img[alt^='Page']").first().waitFor({ timeout: 30_000 });

  // ページ 10, 20, 30 を取得
  const targets = [10, 20, 30];
  const dataUrls = await page.evaluate((pages) => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']"));
    return pages.map((n) => {
      const img = imgs[n - 1];
      return img ? { alt: img.alt, src: img.src } : null;
    }).filter(Boolean);
  }, targets);

  fs.mkdirSync("test-results/pages", { recursive: true });
  for (const item of dataUrls) {
    if (!item || !item.src.startsWith("data:image/")) continue;
    const base64 = item.src.split(",")[1];
    const buf = Buffer.from(base64, "base64");
    const fname = `test-results/pages/${item.alt.replace(" ", "_")}.png`;
    fs.writeFileSync(fname, buf);
    console.log(`保存: ${fname} (${Math.round(buf.length / 1024)}KB)`);
  }
});
