const { chromium } = require("playwright");
const { resolve } = require("path");
const { readFileSync, writeFileSync } = require("fs");

async function generateOgImage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });

  const htmlPath = resolve("src/index.html");
  await page.goto(`file://${htmlPath}`);

  await page.waitForTimeout(500);

  const pngPath = resolve("src/public/og-image.png");
  await page.screenshot({
    path: pngPath,
    type: "png",
  });

  await browser.close();
  console.log("✓ Generated og-image.png from HTML");
}

generateOgImage().catch((err) => {
  console.error("Error generating og-image.png:", err);
  process.exit(1);
});
