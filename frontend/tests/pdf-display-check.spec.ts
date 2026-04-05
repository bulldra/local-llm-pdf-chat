import { test, expect } from "@playwright/test";

const PDF_PATH = "/Users/bulldra/Downloads/oreilly-978-4-8144-0108-6e.pdf";

test("サムネイルの表示サイズを計測", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const input = page.locator('input[type="file"]');
  await input.setInputFiles(PDF_PATH);

  await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

  // 表示上の bounding box と natural サイズを比較
  const data = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']")).slice(0, 5);
    return imgs.map((img) => {
      const box = img.getBoundingClientRect();
      return {
        alt: img.alt,
        // CSS で表示されている実サイズ
        displayW: Math.round(box.width),
        displayH: Math.round(box.height),
        displayRatio: box.height / box.width,
        // 画像データの実ピクセルサイズ
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        naturalRatio: img.naturalHeight / img.naturalWidth,
        // 親要素サイズ
        parentW: Math.round(img.parentElement?.getBoundingClientRect().width ?? 0),
        parentH: Math.round(img.parentElement?.getBoundingClientRect().height ?? 0),
      };
    });
  });

  console.log("\n=== サムネイル表示サイズ ===");
  for (const d of data) {
    const ratioOk = Math.abs(d.displayRatio - d.naturalRatio) < 0.05 ? "✓" : "✗ 歪み";
    console.log(
      `${d.alt}: 表示=${d.displayW}x${d.displayH}(比=${d.displayRatio.toFixed(2)}) ` +
      `実データ=${d.naturalW}x${d.naturalH}(比=${d.naturalRatio.toFixed(2)}) ` +
      `親=${d.parentW}x${d.parentH} ${ratioOk}`
    );
  }

  await page.screenshot({ path: "test-results/pdf-display-check.png" });
});
