const QRCode = require("qrcode");
const { writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");

/**
 * Generates a QR code pointing to the live app.
 */
async function generateQRCode() {
  mkdirSync("dist", { recursive: true });

  const url = "https://www.johnsy.com/QRTY/";

  try {
    const qrDistPath = join(process.cwd(), "dist", "qr-code.png");

    await QRCode.toFile(qrDistPath, url, {
      type: "png",
      width: 300,
      margin: 1,
      color: {
        dark: "#1565C0",
        light: "#ffffff",
      },
    });

    // Also emit to assets for README previews
    const qrAssetsPath = join(process.cwd(), "assets", "qr-code.png");
    await QRCode.toFile(qrAssetsPath, url, {
      type: "png",
      width: 300,
      margin: 1,
      color: {
        dark: "#1565C0",
        light: "#ffffff",
      },
    });

    console.log("✓ Generated qr-code.png");
  } catch (err) {
    console.error("Error generating QR code:", err);
    process.exit(1);
  }
}

generateQRCode();
