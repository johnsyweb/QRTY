// @ts-check

const { chromium } = require("playwright");
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");

/**
 * Generates favicon and touch icons from the base SVG asset.
 * @returns {Promise<void>}
 */
async function generateIcons() {
  mkdirSync("dist", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const svgPath = join(process.cwd(), "src/icon.svg");
  let svgContent = readFileSync(svgPath, "utf-8");

  // Normalize palette to match main site's accessible colours
  // Map Solarized-inspired colours to Material Design 3 palette
  const colourMap: Record<string, string> = {
    "#fdf6e3": "#f5f5f5", // light surface
    "#fefaf0": "#fafafa", // lighter surface
    "#268bd2": "#1565C0", // primary
    "#657b83": "#616161", // muted text
    "#2aa198": "#66BB6A", // accent (green)
    "#b58900": "#FFB300", // accent (amber)
  };

  for (const [from, to] of Object.entries(colourMap)) {
    const re = new RegExp(from, "gi");
    svgContent = svgContent.replace(re, to);
  }

  /** @type {{ size: number; name: string }[]} */
  const sizes = [
    { size: 180, name: "apple-touch-icon.png" },
    { size: 192, name: "icon-192.png" },
    { size: 512, name: "icon-512.png" },
    { size: 32, name: "favicon-32x32.png" },
    { size: 16, name: "favicon-16x16.png" },
  ];

  for (const { size, name } of sizes) {
    await page.setViewportSize({ width: size, height: size });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; }
            svg { display: block; width: 100%; height: 100%; }
          </style>
        </head>
        <body>${svgContent}</body>
      </html>
    `;

    await page.setContent(html);

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: false,
    });

    const distOutputPath = join(process.cwd(), "dist", name);
    writeFileSync(distOutputPath, screenshot);

    // Also emit selected icons to assets for README previews when applicable
    if (
      name === "icon-512.png" ||
      name === "apple-touch-icon.png" ||
      name === "favicon-32x32.png" ||
      name === "favicon-16x16.png" ||
      name === "icon-192.png"
    ) {
      const assetsOutputPath = join(process.cwd(), "assets", name);
      writeFileSync(assetsOutputPath, screenshot);
    }

    console.log(
      `✓ Generated ${name} (${size}x${size}) in dist/` +
        (name ? " and assets/" : "")
    );
  }

  await browser.close();
}

generateIcons().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
