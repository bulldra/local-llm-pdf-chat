import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const PDF_PATH = "/Users/bulldra/Downloads/oreilly-978-4-8144-0108-6e.pdf";

test("PDFページを全件レンダリングして画像を検証", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/");

  const input = page.locator('input[type="file"]');
  await input.setInputFiles(PDF_PATH);

  // サムネイル表示まで待機
  await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 60_000 });

  // 全imgのsrcを取得して検証
  const results = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']"));
    return imgs.map((img) => {
      const src = img.src;
      const isDataUrl = src.startsWith("data:image/");
      const byteLength = isDataUrl ? Math.round((src.length * 3) / 4) : 0;
      // 空白ページ判定: 1KB未満は極端に小さい
      return {
        alt: img.alt,
        isDataUrl,
        byteLength,
        tooSmall: byteLength < 1024,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    });
  });

  const totalPages = results.length;
  const failedPages = results.filter((r) => !r.isDataUrl || r.tooSmall || r.naturalWidth === 0);

  // 結果をコンソール出力
  console.log(`\n=== レンダリング結果 ===`);
  console.log(`総ページ数: ${totalPages}`);
  console.log(`正常: ${totalPages - failedPages.length}`);
  console.log(`問題あり: ${failedPages.length}`);

  if (failedPages.length > 0) {
    console.log("\n--- 問題のあるページ ---");
    for (const p of failedPages) {
      console.log(`  ${p.alt}: isDataUrl=${p.isDataUrl}, size=${p.byteLength}B, w=${p.naturalWidth}, h=${p.naturalHeight}`);
    }
  }

  // サイズ分布
  const sizes = results.map((r) => r.byteLength).sort((a, b) => a - b);
  console.log(`\nサイズ範囲: ${sizes[0]}B 〜 ${sizes[sizes.length - 1]}B`);
  console.log(`中央値: ${sizes[Math.floor(sizes.length / 2)]}B`);

  // 最初の5ページのスクリーンショット
  await page.screenshot({ path: "test-results/pdf-render-check.png" });

  // 失敗ページがあればテスト失敗
  expect(failedPages, `問題のあるページ: ${failedPages.map((p) => p.alt).join(", ")}`).toHaveLength(0);
});
