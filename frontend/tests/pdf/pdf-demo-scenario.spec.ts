/**
 * プロモーションビデオ用デモシナリオ
 * 2つのPDFをアップロード → ページ選択 → チャット送信 → 応答受信
 */
import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_1 = path.resolve(__dirname, "Ambient_AI_Beyond_Words.pdf");
const PDF_2 = path.resolve(__dirname, "AI_Context_Engineering_game.pdf");

/** 動画映え用の待機 */
const pause = (ms = 800) => new Promise((r) => setTimeout(r, ms));

test("2つのPDFを読み込んでチャットで応答を得る", async ({ page }) => {
  test.setTimeout(300_000);

  // --- アプリ起動 ---
  await page.goto("/");
  await expect(page.getByText("PDF Vision Chat")).toBeVisible();
  await pause(1000);

  // LM Studio 接続確認
  try {
    await page.locator("select").waitFor({ timeout: 8_000 });
  } catch {
    test.skip(true, "LM Studio が起動していないためスキップ");
  }

  const input = page.locator('input[type="file"]');

  // --- 1つ目のPDFアップロード ---
  await input.setInputFiles(PDF_1);
  await expect(page.getByText("レンダリング中...")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("レンダリング中...")).not.toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Ambient_AI_Beyond_Words.pdf")).toBeVisible();
  await pause(1200);

  // --- 2つ目のPDFアップロード ---
  await input.setInputFiles(PDF_2);
  await expect(page.getByText("レンダリング中...")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("レンダリング中...")).not.toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("AI_Context_Engineering_game.pdf")).toBeVisible();
  await pause(1200);

  // 両方のPDFが表示されていることを確認
  await expect(page.getByText("Ambient_AI_Beyond_Words.pdf")).toBeVisible();
  await expect(page.getByText("AI_Context_Engineering_game.pdf")).toBeVisible();

  // --- ページ選択を調整（各PDFから1ページずつ） ---
  // 一旦全クリア
  const clearButtons = page.getByRole("button", { name: "クリア" });
  for (let i = 0; i < (await clearButtons.count()); i++) {
    await clearButtons.nth(i).click();
    await pause(400);
  }
  await pause(600);

  // 1つ目のPDFから1ページ目を選択
  await page.locator("img[alt='Page 1']").first().click();
  await pause(400);

  // 2つ目のPDFから1ページ目を選択
  const pdf2Images = page.locator("img[alt='Page 1']");
  if ((await pdf2Images.count()) > 1) {
    await pdf2Images.nth(1).click();
  } else {
    // alt名がユニークな場合
    await page.locator("img[alt^='Page']").last().click();
  }
  await pause(800);

  // ページ選択数を確認（2ページ選択されている）
  const selectionTexts = page.getByText(/ページ選択中/);
  const count = await selectionTexts.count();
  let totalSelected = 0;
  for (let i = 0; i < count; i++) {
    const text = await selectionTexts.nth(i).textContent();
    const match = text?.match(/(\d+) \/ \d+/);
    if (match) totalSelected += Number(match[1]);
  }
  console.log(`選択ページ合計: ${totalSelected}`);
  expect(totalSelected).toBe(2);

  // --- チャット: 読み取り＋表形式で一発まとめ ---
  const textarea = page.locator("textarea");
  const question =
    "それぞれのスライドの内容を正確に読み取り、以下の項目を表形式でまとめてください。\n\n列: 「項目」「スライド1: Ambient AI」「スライド2: Context Engineering」\n行: タイトル・サブタイトル・主要キーワード・対象読者・主張のポイント・活用される技術・期待される効果";
  await textarea.fill(question);
  await pause(1000);

  await page.getByRole("button", { name: "送信" }).click();

  // ユーザーメッセージが表示される
  await expect(page.getByText("表形式でまとめ")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("画像 2 ページ添付")).toBeVisible();

  // ストリーミング応答を受信
  const scroll = page.locator('[data-testid="scroll"]');
  await expect(page.locator('[title="キャンセル"]')).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    const text = await scroll.innerText();
    const cleaned = text
      .replace(/▋/g, "")
      .replace(/表形式でまとめ/g, "")
      .replace(/画像 \d+ ページ添付/g, "")
      .replace(/左のパネルでPDFを読み込み.*質問してください/g, "")
      .trim();
    expect(cleaned.length).toBeGreaterThan(0);
  }).toPass({ timeout: 60_000, intervals: [1_000] });
  await expect(page.locator('[title="キャンセル"]')).not.toBeVisible({ timeout: 300_000 });

  // テーブルが描画されていることを検証
  const tableRows = page.locator('[data-testid="scroll"] table tr');
  const rowCount = await tableRows.count();
  console.log(`テーブル行数: ${rowCount}`);
  expect(rowCount).toBeGreaterThanOrEqual(2);

  const fullText = await scroll.innerText();
  console.log(`応答文字数: ${fullText.length}`);
  expect(fullText.length).toBeGreaterThan(100);

  await pause(2000);

  // 最終スクリーンショット
  await page.screenshot({ path: "test-results/demo-scenario-final.png", fullPage: true });
});
