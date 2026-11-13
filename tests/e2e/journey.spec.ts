import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Requires: local test DB prepared with `npx tsx tests/e2e/setup-db.ts`, app running at baseURL.
const ADMIN = { email: "e2e-admin@example.test", password: "E2e-admin-pass-123" };
const SUPPORT = { email: "e2e-support@example.test", password: "E2e-admin-pass-123" };
// Stable for the whole run (written by setup-db.ts) so a worker restart after a failure keeps the same identities.
const stamp = fs.readFileSync(path.join(__dirname, ".run-id"), "utf8").trim();
const FIXED_CUSTOMER = { email: "e2e-customer@example.test", password: "Customer-pass-1" };
const CUSTOMER = { name: "E2E Customer", email: `e2e-${stamp}@example.test`, password: "Customer-pass-1" };
let orderNumber = "";

async function login(page: Page, who: { email: string; password: string }, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.locator("main input[name=email]").fill(who.email);
  await page.locator("main input[name=password]").fill(who.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { waitUntil: "commit" });
}

async function addToCart(page: Page, slug: string, qty = 1) {
  await page.goto(`/products/${slug}`);
  for (let i = 1; i < qty; i++) await page.getByRole("button", { name: "Increase quantity" }).first().click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("dialog", { name: "Shopping cart" })).toBeVisible();
}

async function fillAddress(page: Page, pin: string) {
  await page.locator("#addr-fullName").fill("E2E Receiver");
  await page.locator("#addr-phone").fill("9876543210");
  await page.locator("#addr-line1").fill("12 Test Street");
  await page.locator("#addr-city").fill("Kozhikode");
  await page.locator("#addr-pincode").fill(pin);
}

async function placeOrder(page: Page) {
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: /Place order/ }).click();
}

test.describe.serial("customer → admin order lifecycle (bank transfer)", () => {
  test("customer registers, searches, buys with coupon and submits a transfer reference", async ({ page }) => {
    await page.goto("/register");
    await page.locator("main input[name=name]").fill(CUSTOMER.name);
    await page.locator("main input[name=email]").fill(CUSTOMER.email);
    await page.locator("main input[name=password]").fill(CUSTOMER.password);
    await page.locator("main input[name=confirm]").fill(CUSTOMER.password);
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/account/);

    await page.goto("/shop?q=mace");
    await expect(page.getByText(/1 product/)).toBeVisible();
    await addToCart(page, "premium-whole-mace", 2);

    await page.goto("/checkout");
    await fillAddress(page, "673001");
    await expect(page.getByText(/E2E Kozhikode/)).toBeVisible();

    await page.getByLabel("Coupon code").fill("E2EOLD");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("This coupon has expired.")).toBeVisible();
    await page.getByLabel("Coupon code").fill("E2E10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Coupon applied")).toBeVisible();

    await page.getByText("Bank transfer / UPI").click();
    await placeOrder(page);
    await page.waitForURL(/\/account\/orders\/DZ-.*placed=1/);
    orderNumber = page.url().match(/orders\/(DZ-[A-Z0-9-]+)/)![1];
    await expect(page.getByText("Pay by bank transfer")).toBeVisible();
    await expect(page.getByText("000011112222")).toBeVisible();

    await page.getByLabel("UTR / transaction reference").fill(`UTR${stamp}`);
    await page.getByRole("button", { name: "Submit payment details" }).click();
    await expect(page.getByText(/received your payment details/)).toBeVisible();
  });

  test("duplicate submit is impossible: cart is empty afterwards", async ({ page }) => {
    await login(page, CUSTOMER, "/account");
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
  });

  test("support role cannot verify payments", async ({ page }) => {
    await login(page, SUPPORT, "/admin/payments");
    await page.goto("/admin/payments");
    await expect(page).toHaveURL(/\/admin\?denied=payments\.verify/);
  });

  test("admin verifies the transfer and fulfils the order", async ({ page }) => {
    await login(page, ADMIN, "/admin/payments");
    await page.goto("/admin/payments");
    const card = page.locator("div").filter({ hasText: `UTR UTR${stamp}` }).filter({ has: page.getByRole("button", { name: "Verify payment" }) }).last();
    await card.getByRole("button", { name: "Verify payment" }).click();
    // Verified transfers leave the queue (the page refreshes on success).
    await expect(page.getByText(`UTR UTR${stamp}`)).toHaveCount(0);

    await page.goto("/admin/orders?q=" + orderNumber);
    await page.getByRole("link", { name: orderNumber }).click();
    await expect(page.locator("label").filter({ hasText: /^Packed$/ })).toBeVisible();

    const move = async (label: string) => {
      await page.locator("label").filter({ hasText: new RegExp(`^${label}$`) }).click();
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByText(`Status changed to ${label}.`)).toBeVisible();
    };
    await move("Packed");
    await page.getByLabel("Courier").fill("India Post");
    await page.getByLabel("AWB / tracking number").fill(`AWB${stamp}`);
    await page.getByRole("button", { name: "Save shipment" }).click();
    await expect(page.getByText("Shipment details saved.")).toBeVisible();
    await move("Shipped");
    await move("Out for delivery");
    await move("Delivered");
  });

  test("customer tracks the order, downloads the invoice and requests a return", async ({ page, request }) => {
    await login(page, CUSTOMER, `/account/orders/${orderNumber}`);
    await page.goto(`/account/orders/${orderNumber}`);
    await expect(page.getByText(`AWB${stamp}`)).toBeVisible();
    await expect(page.getByText("Delivered").first()).toBeVisible();
    const invoice = await page.request.get(`/api/invoices/${orderNumber}`);
    expect(invoice.status()).toBe(200);
    expect(invoice.headers()["content-type"]).toContain("application/pdf");
    // A stranger can't fetch it.
    expect((await request.get(`/api/invoices/${orderNumber}`)).status()).toBe(404);

    await page.goto("/account/orders");
    await expect(page.getByText(orderNumber)).toBeVisible();

    await page.goto(`/account/orders/${orderNumber}/return`);
    await page.getByLabel(/Quantity of .* to return/).first().selectOption("1");
    await page.getByLabel("Reason").selectOption("Damaged or leaking package");
    await page.getByRole("button", { name: "Request return" }).click();
    await expect(page.getByText(/Return requested|return request has been received/)).toBeVisible();
  });

  test("admin inspects the return; resellable stock goes back", async ({ page }) => {
    await login(page, ADMIN, "/admin/returns");
    await page.goto("/admin/returns");
    await page.getByRole("link", { name: orderNumber }).click();
    // Each step's form is replaced by the next step once the server accepts it.
    await page.getByRole("button", { name: "Approve return" }).click();
    await expect(page.getByRole("button", { name: "Goods received" })).toBeVisible();
    await page.getByRole("button", { name: "Goods received" }).click();
    await expect(page.getByLabel("Resellable").first()).toBeVisible();
    await page.getByLabel("Resellable").first().check();
    await page.getByRole("button", { name: /Save inspection/ }).click();
    await expect(page.getByRole("button", { name: "Close without refund" })).toBeVisible();
    await page.goto("/admin/inventory?tab=history");
    await expect(page.getByText("Return (resellable)").first()).toBeVisible();
  });
});

test.describe("guest checkout with COD", () => {
  test("COD rules follow the PIN code and the guest link is private", async ({ page, browser }) => {
    await addToCart(page, "premium-cardamom");
    await page.goto("/checkout");
    await page.locator("#co-email").fill(`guest-${stamp}@example.test`);
    await fillAddress(page, "110001");
    await expect(page.getByText("Cash on delivery isn't available for this PIN code.")).toBeVisible();
    await page.locator("#addr-pincode").fill("673001");
    await page.getByText("Cash on delivery", { exact: true }).click();
    await expect(page.getByText("COD charge", { exact: true })).toBeVisible();
    await placeOrder(page);
    await page.waitForURL(/\/order\/DZ-.*placed=1/);
    const url = new URL(page.url());
    await expect(page.getByText("You'll pay in cash on delivery.")).toBeVisible();

    const stranger = await (browser as Browser).newContext();
    const res = await stranger.request.get(url.pathname);
    expect(res.status()).toBe(404);
    await stranger.close();
  });
});

test.describe("access control", () => {
  test("customers can't open admin or other people's orders; private media is hidden", async ({ page, request }) => {
    await login(page, FIXED_CUSTOMER);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
    const other = await page.request.get("/account/orders/DZ-000000-XXXXX");
    expect(other.status()).toBe(404);
    expect((await request.get("/api/media/private?key=private/payment-proofs/x.webp")).status()).toBe(404);
    expect((await request.get("/api/cron/expire-orders")).status()).toBe(404);
    expect((await request.get("/api/admin/customers/export")).status()).toBe(403);
  });
});

test.describe("inventory concurrency", () => {
  test("two shoppers race for the last unit – exactly one order succeeds", async ({ browser }) => {
    const ctxs = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(ctxs.map((c) => c.newPage()));
    for (const [i, p] of pages.entries()) {
      await addToCart(p, "premium-whole-star-anise");
      await p.goto("/checkout");
      await p.locator("#co-email").fill(`race-${i}-${stamp}@example.test`);
      await fillAddress(p, "673001");
      await p.getByText("Bank transfer / UPI").click();
      await p.getByLabel(/I agree to the/).check();
    }
    await Promise.all(pages.map((p) => p.getByRole("button", { name: /Place order/ }).click()));
    await Promise.all(pages.map((p) => p.waitForURL(/\/order\//, { timeout: 15_000 }).catch(() => null)));
    const placed = pages.filter((p) => p.url().includes("/order/")).length;
    expect(placed).toBe(1);
    const loser = pages.find((p) => !p.url().includes("/order/"))!;
    await expect(loser.locator("p[role=alert]")).toContainText(/sold out|out of stock|left|no longer available/);
    await Promise.all(ctxs.map((c) => c.close()));
  });
});
