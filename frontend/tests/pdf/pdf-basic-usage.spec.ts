/**
 * PDF 基本操作テスト
 * PDFアップロード → サムネイル表示 → ページ選択 → チャット送信
 */
import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.resolve(__dirname, "Ambient_AI_Beyond_Words.pdf");

test.describe("PDF 基本操作", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PDF Vision Chat")).toBeVisible();
  });

  test("アプリが正常に起動し、ドロップゾーンが表示される", async ({ page }) => {
    // ドロップゾーンが表示
    await expect(page.locator('input[type="file"]')).toBeAttached();
    await expect(page.getByText("PDFをドラッグ＆ドロップ")).toBeVisible();

    // ヘッダーにモデル選択 or エラーが表示される
    const modelSelect = page.locator("select");
    const modelError = page.getByText("LM Studio に接続できません");
    await expect(modelSelect.or(modelError)).toBeVisible({ timeout: 10_000 });
  });

  test("PDFをアップロードするとサムネイルが表示される", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);

    // レンダリング中表示
    await expect(page.getByText("レンダリング中...")).toBeVisible({ timeout: 10_000 });

    // サムネイルが表示される
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // 複数ページがレンダリングされる
    const imgCount = await page.locator("img[alt^='Page']").count();
    console.log(`表示サムネイル数: ${imgCount}`);
    expect(imgCount).toBeGreaterThan(0);

    // ファイル名がアコーディオンヘッダーに表示される
    await expect(page.getByText("Ambient_AI_Beyond_Words.pdf")).toBeVisible({ timeout: 5_000 });
  });

  test("全選択・クリアボタンでページ選択を切り替えられる", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // 全選択・クリアボタンが表示される
    const selectAllBtn = page.getByRole("button", { name: "全選択" });
    const clearBtn = page.getByRole("button", { name: "クリア" });
    await expect(selectAllBtn).toBeVisible();
    await expect(clearBtn).toBeVisible();

    // クリアでページ選択が0になる
    await clearBtn.click();
    await expect(page.getByText(/0 \/ \d+ ページ選択中/)).toBeVisible();

    // 全選択でページが全て選択される
    await selectAllBtn.click();
    const countText = await page.getByText(/ページ選択中/).textContent();
    const match = countText?.match(/(\d+) \/ (\d+)/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe(match![2]); // 選択数 === 総数
  });

  test("個別ページのクリックで選択をトグルできる", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // まずクリアして全解除
    await page.getByRole("button", { name: "クリア" }).click();
    await expect(page.getByText(/0 \/ \d+ ページ選択中/)).toBeVisible();

    // Page 1 をクリックして選択
    await page.locator("img[alt='Page 1']").click();
    await expect(page.getByText(/1 \/ \d+ ページ選択中/)).toBeVisible();

    // Page 1 の枠線が選択色(#4f8ef7)になっていることを確認
    const page1Container = page.locator("img[alt='Page 1']").locator("..");
    const border = await page1Container.evaluate((el) => getComputedStyle(el).borderColor);
    expect(border).toContain("79, 142, 247"); // #4f8ef7 の RGB

    // もう一度クリックで選択解除
    await page.locator("img[alt='Page 1']").click();
    await expect(page.getByText(/0 \/ \d+ ページ選択中/)).toBeVisible();
  });

  test("PDFロード後に自動選択される（最大20ページ）", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // レンダリング完了を待つ
    await expect(page.getByText("レンダリング中...")).not.toBeVisible({ timeout: 30_000 });

    // 自動選択数を確認
    const countText = await page.getByText(/ページ選択中/).textContent();
    const match = countText?.match(/(\d+) \/ (\d+)/);
    expect(match).toBeTruthy();
    const selectedCount = Number(match![1]);
    const totalCount = Number(match![2]);
    // 20ページ以下なら全選択、それ以上なら20ページ
    const expected = Math.min(totalCount, 20);
    expect(selectedCount).toBe(expected);
  });

  test("PDFロード後に自動プロンプトがセットされる", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // テキストエリアに自動プロンプトが入る
    const textarea = page.locator("textarea");
    await expect(textarea).toHaveValue("このPDFの内容を詳しく解説してください。", { timeout: 15_000 });
  });

  test("アコーディオンの折りたたみ・展開ができる", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // アコーディオンヘッダーをクリックして折りたたみ
    await page.getByText("Ambient_AI_Beyond_Words.pdf").click();

    // サムネイルが非表示になる
    await expect(page.locator("img[alt='Page 1']")).not.toBeVisible();

    // もう一度クリックで展開
    await page.getByText("Ambient_AI_Beyond_Words.pdf").click();
    await expect(page.locator("img[alt='Page 1']")).toBeVisible();
  });

  test("PDFを削除できる", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // 削除ボタン（×）をクリック
    await page.locator('[title="PDFを削除"]').click();

    // サムネイルが消える
    await expect(page.locator("img[alt^='Page']")).toHaveCount(0);

    // ドロップゾーンに戻る
    await expect(page.getByText("PDFをドラッグ＆ドロップ")).toBeVisible();
  });

  test("サムネイルの画像データが正常（4px圧縮されていない）", async ({ page }) => {
    test.setTimeout(60_000);

    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    const results = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[alt^='Page']"));
      return imgs.slice(0, 3).map((img) => ({
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      }));
    });

    for (const r of results) {
      console.log(`${r.alt}: ${r.naturalWidth}x${r.naturalHeight}`);
      expect(r.naturalWidth, `${r.alt} width`).toBeGreaterThan(100);
      expect(r.naturalHeight, `${r.alt} height`).toBeGreaterThan(100);
    }
  });

  test("複数PDFをアップロードできる", async ({ page }) => {
    test.setTimeout(90_000);

    const pdf2Path = path.resolve(__dirname, "AI_Context_Engineering_game.pdf");
    const input = page.locator('input[type="file"]');

    // 1つ目のPDF
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("レンダリング中...")).not.toBeVisible({ timeout: 30_000 });

    // 2つ目のPDF
    await input.setInputFiles(pdf2Path);
    await expect(page.getByText("レンダリング中...")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("レンダリング中...")).not.toBeVisible({ timeout: 30_000 });

    // 両方のファイル名が表示される
    await expect(page.getByText("Ambient_AI_Beyond_Words.pdf")).toBeVisible();
    await expect(page.getByText("AI_Context_Engineering_game.pdf")).toBeVisible();
  });
});

test.describe("チャット送信", () => {
  /** PDF読み込み＋LM Studio接続済みの状態にするヘルパー */
  async function setupWithPdf(page: import("@playwright/test").Page) {
    await page.goto("/");
    await expect(page.getByText("PDF Vision Chat")).toBeVisible();

    // LM Studio が起動していない場合はスキップ
    try {
      await page.locator("select").waitFor({ timeout: 8_000 });
    } catch {
      test.skip(true, "LM Studio が起動していないためスキップ");
    }

    // PDFアップロード
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(PDF_PATH);
    await expect(page.locator("img[alt^='Page']").first()).toBeVisible({ timeout: 30_000 });

    // 1ページだけ選択（応答速度のため）
    await page.getByRole("button", { name: "クリア" }).click();
    await page.locator("img[alt='Page 1']").click();
  }

  test("メッセージを送信するとユーザーバブルが表示される", async ({ page }) => {
    test.setTimeout(120_000);
    await setupWithPdf(page);

    const textarea = page.locator("textarea");
    await textarea.fill("テスト質問です");
    await page.getByRole("button", { name: "送信" }).click();

    // ユーザーメッセージが表示される
    await expect(page.getByText("テスト質問です")).toBeVisible({ timeout: 10_000 });

    // 画像添付バッジが表示される
    await expect(page.getByText("画像 1 ページ添付")).toBeVisible();
  });

  test("送信後にストリーミング応答を受信できる", async ({ page }) => {
    test.setTimeout(300_000);
    await setupWithPdf(page);

    const textarea = page.locator("textarea");
    await textarea.fill("この画像に何が書かれているか1行で答えてください。");
    await page.getByRole("button", { name: "送信" }).click();

    // ストリーミング開始: キャンセルボタンが表示される
    await expect(page.locator('[title="キャンセル"]')).toBeVisible({ timeout: 30_000 });

    // 最初のトークンが届くことを確認
    await expect(async () => {
      const scroll = page.locator('[data-testid="scroll"]');
      const text = await scroll.innerText();
      const withoutCursor = text
        .replace(/▋/g, "")
        .replace(/この画像に何が書かれているか1行で答えてください。/g, "")
        .replace(/画像 1 ページ添付/g, "")
        .replace(/左のパネルでPDFを読み込み.*質問してください/g, "")
        .trim();
      expect(withoutCursor.length).toBeGreaterThan(0);
    }).toPass({ timeout: 60_000, intervals: [1_000] });

    // ストリーミング完了: キャンセルボタンが消える
    await expect(page.locator('[title="キャンセル"]')).not.toBeVisible({ timeout: 300_000 });

    // アシスタント応答が一定の長さ以上ある
    const scroll = page.locator('[data-testid="scroll"]');
    const fullText = await scroll.innerText();
    const responseOnly = fullText
      .replace(/この画像に何が書かれているか1行で答えてください。/g, "")
      .replace(/画像 1 ページ添付/g, "")
      .trim();
    console.log(`応答文字数: ${responseOnly.length}`);
    expect(responseOnly.length).toBeGreaterThan(5);

    await page.screenshot({ path: "test-results/chat-response.png" });
  });

  test("ストリーミング中にキャンセルできる", async ({ page }) => {
    test.setTimeout(120_000);
    await setupWithPdf(page);

    const textarea = page.locator("textarea");
    await textarea.fill("この画像の内容を詳しく解説してください。");
    await page.getByRole("button", { name: "送信" }).click();

    // キャンセルボタンが出たらクリック
    await expect(page.locator('[title="キャンセル"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('[title="キャンセル"]').click();

    // キャンセル後にストリーミングが止まる
    await expect(page.locator('[title="キャンセル"]')).not.toBeVisible({ timeout: 10_000 });

    // 再実行・再編集ボタンが表示される
    await expect(page.locator('[title="再実行"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[title="再編集"]')).toBeVisible();
  });

  test("再編集ボタンでメッセージをテキストエリアに戻せる", async ({ page }) => {
    test.setTimeout(120_000);
    await setupWithPdf(page);

    const textarea = page.locator("textarea");
    const question = "テスト再編集の質問";
    await textarea.fill(question);
    await page.getByRole("button", { name: "送信" }).click();

    // ストリーミング完了を待つ（またはキャンセル）
    await expect(page.locator('[title="キャンセル"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('[title="キャンセル"]').click();
    await expect(page.locator('[title="キャンセル"]')).not.toBeVisible({ timeout: 10_000 });

    // 再編集ボタンをクリック
    await page.locator('[title="再編集"]').click();

    // テキストエリアにメッセージが戻る
    await expect(textarea).toHaveValue(question);
  });

  test("Shift+Enterでメッセージを送信できる", async ({ page }) => {
    test.setTimeout(120_000);
    await setupWithPdf(page);

    const textarea = page.locator("textarea");
    await textarea.fill("Shift+Enterテスト");
    await textarea.press("Shift+Enter");

    // ユーザーメッセージが表示される
    await expect(page.getByText("Shift+Enterテスト")).toBeVisible({ timeout: 10_000 });
  });

  test("ページ未選択時は画像添付バッジが表示されない", async ({ page }) => {
    test.setTimeout(120_000);
    await setupWithPdf(page);

    // 全ページをクリアして0選択にする
    await page.getByRole("button", { name: "クリア" }).click();
    await expect(page.getByText(/0 \/ \d+ ページ選択中/)).toBeVisible();

    const textarea = page.locator("textarea");
    await textarea.fill("ページなしテスト");
    await page.getByRole("button", { name: "送信" }).click();

    // ユーザーメッセージは表示される
    await expect(page.getByText("ページなしテスト")).toBeVisible({ timeout: 10_000 });

    // 画像添付バッジは表示されない
    await expect(page.getByText(/画像.*ページ添付/)).not.toBeVisible();
  });
});
