const { chromium } = require("playwright");
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");

/**
 * Generates OpenGraph image from the rendered HTML page.
 */
async function generateOGImage() {
  mkdirSync("dist", { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to a common OG image size (1200x630 is standard for social media)
  await page.setViewportSize({ width: 1200, height: 630 });

  // Read the generated dist/index.html
  const htmlPath = join(process.cwd(), "dist/index.html");
  const htmlContent = readFileSync(htmlPath, "utf-8");

  // Set content and wait for rendering
  await page.setContent(htmlContent);
  await page.waitForLoadState("networkidle");

  // Take screenshot
  const screenshot = await page.screenshot({
    type: "png",
    omitBackground: false,
    fullPage: false,
  });

  // Write to dist
  const outputPath = join(process.cwd(), "dist", "og-image.png");
  writeFileSync(outputPath, screenshot);

  console.log("✓ Generated og-image.png (1200x630)");

  await browser.close();
}

generateOGImage().catch((err) => {
  console.error("Error generating OG image:", err);
  process.exit(1);
});
