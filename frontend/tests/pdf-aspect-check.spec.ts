import { test, expect } from "@playwright/test";

const PDF_PATH = "/Users/bulldra/Downloads/oreilly-978-4-8144-0108-6e.pdf";

test("レンダリング画像の縦横比を検証", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/");

  // pdfjs で直接ページサイズを取得（ブラウザ内で実行）
  const pdfPageSizes = await page.evaluate(async (pdfPath) => {
    // fetch で PDF を読み込む（Playwright のファイルアクセス用）
    const res = await fetch(`/pdf-test-proxy`);
    return null;
  }, PDF_PATH);

  const input = page.locator('input[type="file"]');
  await input.setInputFiles(PDF_PATH);

  await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 60_000 });

  // 各imgの実際のピクセルサイズを取得
  const results = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']"));
    return imgs.slice(0, 20).map((img) => {
      // naturalWidth/Height は dataUrl から decode した実ピクセル
      const aspectRatio = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0;
      return {
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: Math.round(aspectRatio * 1000) / 1000,
        // A4縦: 842/595 ≈ 1.414
        isA4Portrait: aspectRatio > 1.3 && aspectRatio < 1.5,
        isLandscape: aspectRatio < 1.0,
      };
    });
  });

  console.log("\n=== 画像縦横比チェック (先頭20ページ) ===");
  for (const r of results) {
    const flag = r.isA4Portrait ? "✓ A4縦" : r.isLandscape ? "⚠ 横向き" : `? ratio=${r.aspectRatio}`;
    console.log(`  ${r.alt}: ${r.naturalWidth}x${r.naturalHeight} (H/W=${r.aspectRatio}) ${flag}`);
  }

  // canvas サイズとの不一致を確認
  const canvasCheck = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']"));
    return imgs.slice(0, 5).map((img) => {
      // src から画像サイズをImageで再確認
      return {
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        srcLength: img.src.length,
      };
    });
  });

  // スクリーンショット（サムネイルパネル全体）
  await page.screenshot({ path: "test-results/pdf-aspect-check.png" });
  console.log("\nスクリーンショット: test-results/pdf-aspect-check.png");
});
