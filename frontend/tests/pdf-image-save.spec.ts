import { test } from "@playwright/test";
import * as fs from "fs";

const PDF_PATH = "/Users/bulldra/Downloads/oreilly-978-4-8144-0108-6e.pdf";

test("レンダリング画像を保存して確認", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const input = page.locator('input[type="file"]');
  await input.setInputFiles(PDF_PATH);

  await page.locator("img[alt^='Page']").first().waitFor({ timeout: 30_000 });

  // 先頭5ページの dataUrl を取得してPNGとして保存
  const dataUrls = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']")).slice(0, 5);
    return imgs.map((img) => ({ alt: img.alt, src: img.src }));
  });

  fs.mkdirSync("test-results/pages", { recursive: true });

  for (const { alt, src } of dataUrls) {
    if (!src.startsWith("data:image/")) continue;
    const base64 = src.split(",")[1];
    const buf = Buffer.from(base64, "base64");
    const fname = `test-results/pages/${alt.replace(" ", "_")}.png`;
    fs.writeFileSync(fname, buf);
    console.log(`保存: ${fname} (${Math.round(buf.length / 1024)}KB)`);
  }
});
