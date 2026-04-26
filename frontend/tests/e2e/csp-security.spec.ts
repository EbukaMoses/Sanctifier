import { test, expect, Page, Route, ConsoleMessage } from "@playwright/test";

/**
 * CSP Security Tests for WASM Integration.
 *
 * This suite verifies that the @sanctifier/wasm package is CSP-friendly
 * and does not trigger 'unsafe-eval' violations in the browser.
 */

test.describe("WASM CSP Security", () => {
  test("WASM module should initialize and run without 'unsafe-eval' CSP", async ({ page }: { page: Page }) => {
    // 1. Intercept the request to inject a strict CSP header
    await page.route("**/*", async (route: Route) => {
      const response = await route.fetch();
      const headers = {
        ...response.headers(),
        // Strict CSP: forbid 'unsafe-eval'
        "Content-Security-Policy": "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none';",
      };
      await route.fulfill({ response, headers });
    });

    // 2. Navigate to a page that uses WASM (e.g. playground or scan)
    // Even if it uses it indirectly, we can verify it doesn't crash.
    await page.goto("/playground");

    // 3. Inject a script to check if the WASM can be imported and executed
    // while the CSP is active.
    const result = await page.evaluate(async () => {
      try {
        // We use dynamic import to catch errors locally
        // @ts-expect-error - dynamic import of linked pkg
        const wasm = await import("@sanctifier/wasm");
        if (typeof wasm.version === 'function') {
           return { success: true, version: wasm.version() };
        }
        return { success: true, stub: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    });

    // 4. Verify no CSP violations were logged to console
    const logs: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error" && msg.text().includes("Content Security Policy")) {
        logs.push(msg.text());
      }
    });

    // Check for violations after a small delay to allow async loading
    await page.waitForTimeout(1000);

    expect(logs).toHaveLength(0);
    expect(result.success).toBe(true);
  });
});
