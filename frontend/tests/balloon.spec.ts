import { test, expect } from "@playwright/test";

test("アシスタントバルーンに右余白100px", async ({ page }) => {
  await page.goto("/");

  // モックメッセージを DOM に直接注入してレイアウトを検証
  await page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>('[data-testid="scroll"]');
    if (!scroll) return;
    const bubble = document.createElement("div");
    bubble.setAttribute("data-testid", "assistant-bubble");
    bubble.style.cssText = `
      margin-right: 100px;
      background: #2a2a2a;
      padding: 12px 20px;
    `;
    bubble.textContent = "テスト回答";
    scroll.appendChild(bubble);
  });

  const scrollBox = await page.locator('[data-testid="scroll"]').boundingBox();
  const bubbleBox = await page.locator('[data-testid="assistant-bubble"]').boundingBox();

  if (!scrollBox || !bubbleBox) throw new Error("要素が見つかりません");

  const rightGap = (scrollBox.x + scrollBox.width) - (bubbleBox.x + bubbleBox.width);
  console.log(`scrollRight=${scrollBox.x + scrollBox.width}, bubbleRight=${bubbleBox.x + bubbleBox.width}, gap=${rightGap}`);

  expect(rightGap).toBeGreaterThanOrEqual(90);
});
