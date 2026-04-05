import { test, expect } from "@playwright/test";

const PDF_PATH = "/Users/bulldra/Downloads/oreilly-978-4-8144-0108-6e.pdf";

test("グリッドレイアウト - サムネイルが重なっていないこと", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const input = page.locator('input[type="file"]');
  await input.setInputFiles(PDF_PATH);
  await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

  const positions = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("img[alt^='Page']"))
      .slice(0, 12)
      .map((img) => {
        const box = img.parentElement!.getBoundingClientRect();
        return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height) };
      });
    return items;
  });

  console.log("\n=== グリッド行位置 ===");
  for (let i = 0; i < positions.length; i++) {
    console.log(`  Item ${i + 1}: top=${positions[i].top} bottom=${positions[i].bottom} h=${positions[i].height}`);
  }

  // 同じ列の隣接行が重なっていないか確認（列数3想定）
  const cols = 3;
  for (let i = cols; i < positions.length; i++) {
    const prev = positions[i - cols];
    const curr = positions[i];
    const overlap = prev.bottom - curr.top;
    if (overlap > 2) {
      console.log(`  ⚠ Item ${i - cols + 1} と Item ${i + 1} が ${overlap}px 重なっている`);
    }
    expect(overlap, `Item ${i - cols + 1} と Item ${i + 1} が重なっている`).toBeLessThanOrEqual(2);
  }

  await page.screenshot({ path: "test-results/pdf-grid-layout.png" });
});
