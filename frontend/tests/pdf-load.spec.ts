import { test, expect } from "@playwright/test";
import path from "path";

const PDF_PATH = "/Users/bulldra/Downloads/Games_as_AI_Film_Sets.pdf";

test("PDFを読み込んで解説が完了するまで待機", async ({ page }) => {
  test.setTimeout(300_000); // 最大5分

  await page.goto("/");

  // file input にPDFをセット
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(PDF_PATH);

  // ページサムネイルが表示されるまで待機
  await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30000 });

  const imgCount = await page.locator("img[alt^='Page']").count();
  console.log(`レンダリングされたページ数: ${imgCount}`);

  // 自動プロンプトのユーザーメッセージが表示されるまで待機
  await expect(page.getByText("このPDFの内容を詳しく解説してください。")).toBeVisible({ timeout: 15000 });
  console.log("自動プロンプト送信済み");

  // ストリーミング開始: スピナーが出るまで待機
  await expect(page.locator(".spinner").first()).toBeVisible({ timeout: 30000 });
  console.log("ストリーミング開始");

  // ストリーミング完了: スピナーが消えるまで待機
  await expect(page.locator(".spinner").first()).not.toBeVisible({ timeout: 300_000 });
  console.log("ストリーミング完了");

  // 解説内容のスクリーンショット保存
  await page.screenshot({ path: "test-results/pdf-explained.png", fullPage: false });
});
