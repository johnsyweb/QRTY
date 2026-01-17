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
    const qrPath = join(process.cwd(), "dist", "qr-code.png");

    await QRCode.toFile(qrPath, url, {
      type: "png",
      width: 300,
      margin: 1,
      color: {
        dark: "#268bd2",
        light: "#fdf6e3",
      },
    });

    console.log("✓ Generated qr-code.png");
  } catch (err) {
    console.error("Error generating QR code:", err);
    process.exit(1);
  }
}

generateQRCode();
