const { chromium } = require("playwright");
const { resolve } = require("path");
const QRCode = require("qrcode");

async function generateQRCode() {
  try {
    const url = "https://johnsy.com/QRTY/";
    const outputPath = resolve("src/qr-code.png");

    await QRCode.toFile(outputPath, url, {
      width: 512,
      margin: 2,
      color: {
        dark: "#2aa198",
        light: "#fdf6e3",
      },
    });

    console.log(`✓ Generated QR code for ${url} at ${outputPath}`);
  } catch (err) {
    console.error("Error generating QR code:", err);
    process.exit(1);
  }
}

generateQRCode();
