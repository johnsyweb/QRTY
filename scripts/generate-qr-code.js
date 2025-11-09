// @ts-check

const { resolve } = require("path");
/** @type {import("qrcode")} */
const QRCode = require("qrcode");

/**
 * Generates the QRTY site QR code asset.
 * @returns {Promise<void>}
 */
async function generateQRCode() {
  try {
    const url = "https://johnsy.com/QRTY/";
    const outputPath = resolve("src/qr-code.png");

    await QRCode.toFile(outputPath, url, {
      width: 512,
      margin: 2,
      color: {
        dark: "#268bd2",
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
