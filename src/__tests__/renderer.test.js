/* eslint-env jest */

describe("renderer helpers", () => {
  let hooks;
  let originalClipboard;
  let originalShare;
  let originalScrollIntoView;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <header>
        <button id="capture-btn" type="button"></button>
        <label for="file-input" class="file-input-label"></label>
        <input id="file-input" type="file" />
        <p id="capture-support-note"></p>
      </header>
      <div id="video-container" class="hidden">
        <video id="video-preview"></video>
        <canvas id="canvas-preview"></canvas>
        <div class="control-group">
          <button id="stop-capture-btn" type="button"></button>
        </div>
      </div>
      <div id="result-container" class="result-container hidden">
        <div id="result-list" class="result-list"></div>
      </div>
      <button id="reset-btn" type="button"></button>
      <div id="error-container" class="error-container hidden"></div>
    `;

    originalScrollIntoView =
      typeof Element !== "undefined" ? Element.prototype.scrollIntoView : null;
    if (typeof Element !== "undefined") {
      Element.prototype.scrollIntoView = jest.fn();
    }

    originalClipboard = window.navigator.clipboard;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn() },
    });

    originalShare = window.navigator.share;
    window.navigator.share = undefined;

    window.open = jest.fn();
    global.jsQR = jest.fn();

    const canvasContextStub = {
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
      imageSmoothingEnabled: true,
      fillStyle: "#000000",
    };
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => canvasContextStub);

    require("../renderer.js");
    hooks = window.__QRTY_TEST_HOOKS__;
  });

  afterEach(() => {
    if (typeof Element !== "undefined" && originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }

    if (originalClipboard === undefined) {
      delete window.navigator.clipboard;
    } else {
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      });
    }

    window.navigator.share = originalShare;

    if (hooks && typeof hooks.resetBarcodeReaders === "function") {
      hooks.resetBarcodeReaders();
    }

    jest.restoreAllMocks();
    delete window.__QRTY_TEST_HOOKS__;
    delete global.jsQR;
    delete window.ZXing;
  });

  test("mergeUniqueValues merges lists without duplicates", () => {
    const values = hooks.mergeUniqueValues(
      ["https://example.com", "ABC123"],
      ["ABC123", "ZX-9"],
      ["", "ZX-9", "final"]
    );

    expect(values).toEqual(["https://example.com", "ABC123", "ZX-9", "final"]);
  });

  test("isHttpUrl recognises HTTP and HTTPS schemes", () => {
    expect(hooks.isHttpUrl("https://example.com")).toBe(true);
    expect(hooks.isHttpUrl("http://example.com")).toBe(true);
    expect(hooks.isHttpUrl("mailto:person@example.com")).toBe(false);
    expect(hooks.isHttpUrl("random text")).toBe(false);
  });

  test("displayResults renders link and text entries", () => {
    hooks.displayResults(["https://example.com", "CODE-128:12345"]);

    const resultContainer = document.getElementById("result-container");
    expect(resultContainer.classList.contains("hidden")).toBe(false);

    const items = Array.from(
      document.querySelectorAll("#result-list .result-item")
    );
    expect(items).toHaveLength(2);

    const [linkItem, textItem] = items;

    const link = linkItem.querySelector("a.result-link");
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("https://example.com");

    const openButton = linkItem.querySelector(".action-btn.secondary");
    expect(openButton).not.toBeNull();
    expect(openButton?.textContent).toBe("Open");

    const shareButton = linkItem.querySelector(".action-btn:not(.secondary)");
    expect(shareButton).not.toBeNull();
    expect(shareButton?.textContent).toBe("Copy");

    const text = textItem.querySelector("pre.result-text");
    expect(text).not.toBeNull();
    expect(text?.textContent).toBe("CODE-128:12345");
  });

  test("scanBarcodesFromCanvas returns empty list when ZXing is unavailable", () => {
    const canvasMock = {
      width: 120,
      height: 60,
      getContext: () => ({
        getImageData: () => ({
          data: new Uint8ClampedArray(28800),
        }),
      }),
    };

    expect(hooks.scanBarcodesFromCanvas(canvasMock)).toEqual([]);
  });

  test("scanBarcodesFromCanvas returns decoded values after preprocessing", () => {
    const decodeMultiple = jest.fn(() => [
      {
        getText: () => "1234567890",
      },
    ]);
    const reset = jest.fn();
    const setHints = jest.fn();

    window.ZXing = {
      MultiFormatReader: jest.fn().mockImplementation(() => ({
        setHints,
        reset,
      })),
      GenericMultipleBarcodeReader: jest.fn().mockImplementation(() => ({
        decodeMultiple,
      })),
      DecodeHintType: {
        POSSIBLE_FORMATS: "POSSIBLE_FORMATS",
        TRY_HARDER: "TRY_HARDER",
      },
      BarcodeFormat: {
        CODE_128: "CODE_128",
      },
      HybridBinarizer: jest
        .fn()
        .mockImplementation(function HybridBinarizer(source) {
          this.source = source;
        }),
      BinaryBitmap: jest
        .fn()
        .mockImplementation(function BinaryBitmap(binarizer) {
          this.binarizer = binarizer;
        }),
      RGBLuminanceSource: jest
        .fn()
        .mockImplementation(function RGBLuminanceSource(data, width, height) {
          this.data = data;
          this.width = width;
          this.height = height;
        }),
      NotFoundException: class NotFoundException extends Error {},
    };

    const width = 800;
    const height = 800;
    const baseData = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < baseData.length; index += 4) {
      const value = (index / 4) % 256;
      const channel = 80 + (value % 80);
      baseData[index] = channel;
      baseData[index + 1] = channel;
      baseData[index + 2] = channel;
      baseData[index + 3] = 255;
    }

    const canvasMock = {
      width,
      height,
      getContext: jest.fn(() => ({
        drawImage: jest.fn(),
        fillRect: jest.fn(),
        getImageData: jest.fn(() => ({
          data: baseData.slice(),
          width,
          height,
        })),
        imageSmoothingEnabled: true,
        fillStyle: "#000000",
      })),
    };

    const values = hooks.scanBarcodesFromCanvas(canvasMock);

    expect(values).toEqual(["1234567890"]);
    expect(window.ZXing.RGBLuminanceSource).toHaveBeenCalledTimes(1);
    const [processedData] = window.ZXing.RGBLuminanceSource.mock.calls[0];
    expect(processedData).toBeInstanceOf(Uint8ClampedArray);
    expect(processedData.some((channel) => channel === 0)).toBe(true);
    expect(processedData.some((channel) => channel === 255)).toBe(true);
    expect(reset).toHaveBeenCalled();
  });

  test("scanBarcodesFromCanvas decodes a Foretoken-generated barcode", () => {
    const { createCanvas } = require("@napi-rs/canvas");
    const JsBarcode = require("jsbarcode");
    const ZXingLib = require("@zxing/library");

    const token = `P${String(1030).padStart(4, "0")}`;
    const baseCanvas = createCanvas(480, 240);
    const baseContext = baseCanvas.getContext("2d");
    baseContext.fillStyle = "#ffffff";
    baseContext.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

    JsBarcode(baseCanvas, token, {
      format: "CODE128",
      width: 2,
      height: 160,
      margin: 40,
      displayValue: false,
      background: "#ffffff",
      lineColor: "#000000",
    });

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tagName, options) => {
        if (typeof tagName === "string" && tagName.toLowerCase() === "canvas") {
          return createCanvas(1, 1);
        }
        return originalCreateElement(tagName, options);
      });

    const previousZXing = window.ZXing;
    window.ZXing = ZXingLib;

    hooks.resetBarcodeReaders();

    try {
      const values = hooks.scanBarcodesFromCanvas(baseCanvas);
      expect(values).toContain(token);
    } finally {
      if (
        createElementSpy &&
        typeof createElementSpy.mockRestore === "function"
      ) {
        createElementSpy.mockRestore();
      }
      if (previousZXing === undefined) {
        delete window.ZXing;
      } else {
        window.ZXing = previousZXing;
      }
    }
  });
});
