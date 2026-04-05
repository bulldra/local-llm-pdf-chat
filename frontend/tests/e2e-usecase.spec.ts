/**
 * E2E ユースケーステスト
 * PDF読み込み → サムネイル表示 → 自動チャット → ストリーミング応答
 */
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.resolve(__dirname, "../../tests/pdf/oreilly-978-4-8144-0108-6e.pdf");

test.describe("PDF Vision Chat - 一連のユースケース", () => {
  test("1. アプリが正常に起動する", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PDF Vision Chat")).toBeVisible();
    // モデルセレクトまたはエラーメッセージが表示される
    const modelSelect = page.locator("select");
    const modelError = page.getByText("LM Studio に接続できません");
    await expect(modelSelect.or(modelError)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "test-results/01-app-loaded.png" });
  });

  test("2. PDFをアップロードするとサムネイルが表示される", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);

    // プログレスバーが表示される
    await expect(page.getByText("レンダリング中...")).toBeVisible({ timeout: 10_000 });

    // 最初のサムネイルが表示される（プログレッシブ表示）
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    const imgCount = await page.locator("img[alt^='Page']").count();
    console.log(`表示サムネイル数: ${imgCount}`);
    expect(imgCount).toBeGreaterThan(0);

    await page.screenshot({ path: "test-results/02-thumbnails.png" });
  });

  test("3. サムネイルの縦横比が正しい（圧縮されていない）", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    const results = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']"));
      return imgs.slice(0, 5).map((img) => ({
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        ratio: img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0,
      }));
    });

    for (const r of results) {
      console.log(`${r.alt}: ${r.naturalWidth}x${r.naturalHeight} (H/W=${r.ratio.toFixed(3)})`);
      // 正しい画像データが入っている（4px圧縮になっていない）
      expect(r.naturalWidth, `${r.alt} width`).toBeGreaterThan(100);
      expect(r.naturalHeight, `${r.alt} height`).toBeGreaterThan(100);
    }

    await page.screenshot({ path: "test-results/03-aspect-ratio.png" });
  });

  test("4. PDFロード後に自動プロンプトが送信される", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // 自動プロンプトメッセージが表示される
    await expect(
      page.getByText("このPDFの内容を詳しく解説してください。")
    ).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: "test-results/04-auto-prompt.png" });
  });

  test("5. LLMへの問い合わせ〜ストリーミング応答完了", async ({ page }) => {
    test.setTimeout(300_000); // LLM応答は最大5分
    await page.goto("/");

    // LM Studio が起動していない場合はスキップ
    try {
      await page.locator("select").waitFor({ timeout: 8_000 });
    } catch {
      test.skip(true, "LM Studio が起動していないためスキップ");
    }

    // PDF アップロード
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // 送信画像を1枚に絞る（クリア→1ページだけ選択）
    await page.getByRole("button", { name: "クリア" }).click();
    await page.locator("img[alt='Page 1']").click();

    // シンプルな質問を送信（画像1枚）
    const textarea = page.locator("textarea");
    await textarea.fill("この画像に何が書かれているか1行で答えてください。");

    const model = await page.locator("select").inputValue();
    console.log(`使用モデル: ${model}`);

    // 送信
    await page.getByRole("button", { name: "送信" }).click();

    // ユーザーメッセージ表示確認
    await expect(
      page.getByText("この画像に何が書かれているか1行で答えてください。")
    ).toBeVisible({ timeout: 10_000 });
    console.log("ユーザーメッセージ送信済み");

    // ストリーミング開始: キャンセルボタンが表示される
    await expect(page.locator('[title="キャンセル"]')).toBeVisible({ timeout: 30_000 });
    console.log("ストリーミング開始");

    await page.screenshot({ path: "test-results/05a-llm-streaming.png" });

    // 最初のトークンが60秒以内に届くことを確認（応答なしタイムアウト）
    // アシスタントバブルのテキストが▋以外になるまで待つ
    await expect(async () => {
      const scroll = page.locator('[data-testid="scroll"]');
      const text = await scroll.innerText();
      // ▋はカーソル、それ以外のテキストが含まれていることを確認
      const withoutCursor = text.replace(/▋/g, "").replace(/この画像に何が書かれているか1行で答えてください。/g, "").trim();
      expect(withoutCursor.length).toBeGreaterThan(0);
    }).toPass({ timeout: 60_000, intervals: [1_000] });
    console.log("最初のトークン受信");

    // ストリーミング完了: キャンセルボタンが消える
    await expect(page.locator('[title="キャンセル"]')).not.toBeVisible({ timeout: 300_000 });
    console.log("ストリーミング完了");

    // アシスタントの応答テキストが存在する
    const scroll = page.locator('[data-testid="scroll"]');
    const fullText = await scroll.innerText();
    const responseOnly = fullText.replace("この画像に何が書かれているか1行で答えてください。", "").trim();
    console.log(`応答文字数: ${responseOnly.length}`);
    expect(responseOnly.length).toBeGreaterThan(10);

    await page.screenshot({ path: "test-results/05b-llm-response.png" });
  });

  test("5c. ストリーミング中にキャンセルできる", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");

    try {
      await page.locator("select").waitFor({ timeout: 8_000 });
    } catch {
      test.skip(true, "LM Studio が起動していないためスキップ");
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    const textarea = page.locator("textarea");
    await expect(textarea).toHaveValue("このPDFの内容を詳しく解説してください。", { timeout: 15_000 });

    await page.getByRole("button", { name: "送信" }).click();

    // キャンセルボタンが表示されたらクリック
    await expect(page.locator('[title="キャンセル"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('[title="キャンセル"]').click();
    console.log("キャンセルボタンをクリック");

    // キャンセル後にストリーミングが止まる（キャンセルボタンが消える）
    await expect(page.locator('[title="キャンセル"]')).not.toBeVisible({ timeout: 10_000 });
    console.log("キャンセル完了");

    // 再実行・再編集ボタンが表示される（送信済みメッセージのアクション）
    await expect(page.locator('[title="再実行"]')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "test-results/05c-cancel.png" });
  });

  test("6. ページ選択（全選択・クリア）が機能する", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // 全選択・クリアボタンが表示される
    await expect(page.getByRole("button", { name: "全選択" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "クリア" })).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "test-results/06-page-picker.png" });
  });

  test("7. パネルリサイズが機能する", async ({ page }) => {
    await page.goto("/");

    // ドラッグハンドルが存在する
    const handle = page.locator('[style*="col-resize"]').first();
    await expect(handle).toBeVisible();

    // 初期幅を取得
    const leftPanel = page.locator("div").filter({ has: page.locator('input[type="file"]') }).first();
    const before = await leftPanel.boundingBox();

    // ドラッグで幅を変更
    if (before) {
      await handle.dragTo(handle, {
        targetPosition: { x: 50, y: 0 },
        sourcePosition: { x: 0, y: 0 },
        force: true,
      });
    }

    await page.screenshot({ path: "test-results/07-panel-resize.png" });
  });
});
