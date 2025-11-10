type RendererTestHooks = import("./types/renderer-hooks").RendererTestHooks;
type ZXingModule = import("./types/renderer-hooks").ZXingModule;
type ZXingMultipleReader = import("./types/renderer-hooks").ZXingMultipleReader;
type ImageProcessingUtils =
  import("./types/renderer-hooks").ImageProcessingUtils;
type JsQrPoint = { x: number; y: number };
type JsQrResult = {
  data?: string;
  location?: {
    topLeftCorner: JsQrPoint;
    topRightCorner: JsQrPoint;
    bottomRightCorner: JsQrPoint;
    bottomLeftCorner: JsQrPoint;
  };
};

const captureBtn = document.getElementById("capture-btn") as
  | HTMLButtonElement
  | null;
const fileInput = document.getElementById("file-input") as
  | HTMLInputElement
  | null;
const videoContainer = document.getElementById("video-container") as
  | HTMLDivElement
  | null;
const videoPreview = document.getElementById("video-preview") as
  | HTMLVideoElement
  | null;
const canvasPreview = document.getElementById("canvas-preview") as
  | HTMLCanvasElement
  | null;
const stopCaptureBtn = document.getElementById("stop-capture-btn") as
  | HTMLButtonElement
  | null;
const resultContainer = document.getElementById("result-container") as
  | HTMLDivElement
  | null;
const resultList = document.getElementById("result-list") as
  | HTMLDivElement
  | null;
const resetBtn = document.getElementById("reset-btn") as
  | HTMLButtonElement
  | null;
const errorContainer = document.getElementById("error-container") as
  | HTMLDivElement
  | null;
const captureSupportNote = document.getElementById(
  "capture-support-note"
) as HTMLParagraphElement | null;

let stream: MediaStream | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let decodedValues: string[] = [];

const imageUtils = window.QRTY_IMAGE_UTILS as ImageProcessingUtils | undefined;
if (!imageUtils) {
  throw new Error("Image processing utilities are not initialised.");
}

const {
  get2dContext,
  getScaledCanvas,
  addQuietZone,
  normaliseImageData,
  computeOtsuThreshold,
  binariseImageData,
  thickenLinearFeatures,
  getBarcodeImagePayload,
} = imageUtils;

let multiFormatReader: InstanceType<ZXingModule["MultiFormatReader"]> | null =
  null;
let multipleBarcodeReader: ZXingMultipleReader | null = null;
let barcodeHints: Map<any, any> | null = null;

function resetBarcodeReaders(): void {
  multiFormatReader = null;
  multipleBarcodeReader = null;
  barcodeHints = null;
}

if (captureSupportNote) {
  captureSupportNote.textContent =
    "Screen capture works best in modern desktop browsers. If it isn't supported on your device, please use the upload option instead.";
}

function showError(message) {
  if (!errorContainer) return;
  errorContainer.textContent = message;
  errorContainer.classList.remove("hidden");
  errorContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => {
    errorContainer.classList.add("hidden");
  }, 5000);
}

function hideError() {
  if (!errorContainer) return;
  errorContainer.classList.add("hidden");
}

function resetState() {
  if (resultContainer) {
    resultContainer.classList.add("hidden");
  }
  decodedValues = [];
  if (resultList) {
    resultList.innerHTML = "";
  }
  hideError();
  stopCapture();
}

function valuesAreEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function setTemporaryButtonMessage(button, message) {
  if (!button) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = message;
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 2000);
}

/**
 * @param {string} value
 * @param {HTMLButtonElement} button
 */
async function copyToClipboard(value, button) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      setTemporaryButtonMessage(button, "Copied!");
    } catch (error) {
      console.error("Failed to copy value", error);
      showError(`Failed to copy. Please copy this value manually:\n${value}`);
    }
  } else {
    showError(
      `Clipboard access is unavailable. Please copy this value manually:\n${value}`
    );
  }
}

async function shareContent(
  value: string,
  button: HTMLButtonElement,
  options: { isUrl?: boolean } = {}
) {
  const { isUrl = false } = options;
  if (navigator.share) {
    try {
      const shareData = isUrl ? { url: value, text: value } : { text: value };
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      console.warn("navigator.share failed, falling back to copy", error);
    }
  }
  await copyToClipboard(value, button);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function displayResults(values) {
  if (!resultList || !resultContainer) {
    return;
  }
  decodedValues = values.slice();
  resultList.innerHTML = "";

  values.forEach((value) => {
    const item = document.createElement("div");
    item.className = "result-item";

    const isUrl = isHttpUrl(value);

    let primaryContent;
    if (isUrl) {
      const link = document.createElement("a");
      link.href = value;
      link.textContent = value;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "result-link";
      primaryContent = link;
    } else {
      const text = document.createElement("pre");
      text.textContent = value;
      text.className = "result-text";
      primaryContent = text;
    }

    const actions = document.createElement("div");
    actions.className = "result-actions";

    if (isUrl) {
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "action-btn secondary";
      openButton.textContent = "Open";
      openButton.addEventListener("click", () => {
        window.open(value, "_blank", "noopener,noreferrer");
      });
      actions.appendChild(openButton);
    }

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "action-btn";
    shareButton.textContent = navigator.share ? "Share" : "Copy";
    shareButton.addEventListener("click", () => {
      shareContent(value, shareButton, { isUrl });
    });

    actions.appendChild(shareButton);

    item.appendChild(primaryContent);
    item.appendChild(actions);
    resultList.appendChild(item);
  });

  resultContainer.classList.remove("hidden");
  hideError();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {string[]}
 */
function scanQRCodesFromCanvas(canvas) {
  const { width, height } = canvas;
  if (!width || !height) {
    return [];
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [];
  }
  const imageData = ctx.getImageData(0, 0, width, height);
  const workingData = new Uint8ClampedArray(imageData.data);
  const results: { data: string; centerX: number; centerY: number }[] = [];
  const margin = 6;

  for (;;) {
    const code = jsQR(workingData, width, height, {
      inversionAttempts: "attemptBoth",
    }) as JsQrResult | null;

    if (!code || !code.data) {
      break;
    }

    const text = code.data.trim();
    const location = code.location;

    if (!location) {
      break;
    }

    const corners = [
      location.topLeftCorner,
      location.topRightCorner,
      location.bottomRightCorner,
      location.bottomLeftCorner,
    ];

    const centerX = corners.reduce((sum, point) => sum + point.x, 0) / 4;
    const centerY = corners.reduce((sum, point) => sum + point.y, 0) / 4;

    if (text && !results.some((item) => item.data === text)) {
      results.push({ data: text, centerX, centerY });
    }

    const minX = Math.max(
      Math.floor(Math.min(...corners.map((point) => point.x)) - margin),
      0
    );
    const maxX = Math.min(
      Math.ceil(Math.max(...corners.map((point) => point.x)) + margin),
      width - 1
    );
    const minY = Math.max(
      Math.floor(Math.min(...corners.map((point) => point.y)) - margin),
      0
    );
    const maxY = Math.min(
      Math.ceil(Math.max(...corners.map((point) => point.y)) + margin),
      height - 1
    );

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const offset = (y * width + x) * 4;
        workingData[offset] = 255;
        workingData[offset + 1] = 255;
        workingData[offset + 2] = 255;
        workingData[offset + 3] = 255;
      }
    }
  }

  results.sort((a, b) => {
    if (Math.abs(a.centerY - b.centerY) > 20) {
      return a.centerY - b.centerY;
    }
    return a.centerX - b.centerX;
  });

  return results.map((item) => item.data);
}

/**
 * @returns {ZXingMultipleReader | null}
 */
function getMultipleBarcodeReader() {
  /** @type {ZXingModule | undefined} */
  const ZXingLib = window.ZXing;
  if (!ZXingLib) {
    return null;
  }

  if (multipleBarcodeReader) {
    return multipleBarcodeReader;
  }

  const requiredConstructors = [
    "MultiFormatReader",
    "DecodeHintType",
    "BarcodeFormat",
    "HybridBinarizer",
    "BinaryBitmap",
    "RGBLuminanceSource",
  ];

  const hasAllConstructors = requiredConstructors.every(
    (name) => typeof ZXingLib[name] === "function" || ZXingLib[name]
  );

  if (!hasAllConstructors) {
    return null;
  }

  const formats = [
    ZXingLib.BarcodeFormat.CODE_39,
    ZXingLib.BarcodeFormat.CODE_93,
    ZXingLib.BarcodeFormat.CODE_128,
    ZXingLib.BarcodeFormat.EAN_8,
    ZXingLib.BarcodeFormat.EAN_13,
    ZXingLib.BarcodeFormat.UPC_A,
    ZXingLib.BarcodeFormat.UPC_E,
    ZXingLib.BarcodeFormat.ITF,
    ZXingLib.BarcodeFormat.CODABAR,
    ZXingLib.BarcodeFormat.DATA_MATRIX,
    ZXingLib.BarcodeFormat.PDF_417,
    ZXingLib.BarcodeFormat.AZTEC,
  ].filter(Boolean);

  const hints = new Map();
  if (formats.length > 0) {
    hints.set(ZXingLib.DecodeHintType.POSSIBLE_FORMATS, formats);
  }
  hints.set(ZXingLib.DecodeHintType.TRY_HARDER, true);

  multiFormatReader = new ZXingLib.MultiFormatReader();
  multiFormatReader.setHints(hints);
  barcodeHints = hints;

  if (typeof ZXingLib.GenericMultipleBarcodeReader === "function") {
    multipleBarcodeReader = new ZXingLib.GenericMultipleBarcodeReader(
      multiFormatReader
    );
  } else {
    multipleBarcodeReader = {
      decodeMultiple(binaryBitmap) {
        try {
          const result = multiFormatReader.decodeWithState(binaryBitmap);
          return result ? [result] : [];
        } catch (error) {
          if (
            ZXingLib.NotFoundException &&
            error instanceof ZXingLib.NotFoundException
          ) {
            return [];
          }
          throw error;
        } finally {
          if (
            multiFormatReader &&
            typeof multiFormatReader.reset === "function"
          ) {
            multiFormatReader.reset();
          }
        }
      },
    };
  }

  return multipleBarcodeReader;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {string[]}
 */
/**
 * @param {HTMLCanvasElement} canvas
 * @returns {string[]}
 */
function scanBarcodesFromCanvas(canvas) {
  /** @type {ZXingModule | undefined} */
  const ZXingLib = window.ZXing;
  const reader = getMultipleBarcodeReader();

  if (!ZXingLib || !reader) {
    return [];
  }

  const { width, height } = canvas;
  if (!width || !height) {
    return [];
  }

  const payload = getBarcodeImagePayload(canvas);

  if (!payload) {
    return [];
  }

  const { data, width: processedWidth, height: processedHeight } = payload;

  try {
    const createLuminanceSource = () =>
      new ZXingLib.RGBLuminanceSource(
        new Uint8ClampedArray(data),
        processedWidth,
        processedHeight
      );

    const decodeWithBinaryBitmap = (binaryBitmap) => {
      let results = [];

      try {
        results = reader.decodeMultiple(binaryBitmap) || [];
      } catch (error) {
        if (
          !(
            ZXingLib.NotFoundException &&
            error instanceof ZXingLib.NotFoundException
          )
        ) {
          throw error;
        }
      }

      if ((!results || results.length === 0) && multiFormatReader) {
        try {
          const singleResult = multiFormatReader.decodeWithState(binaryBitmap);
          if (singleResult) {
            results = [singleResult];
          }
        } catch (singleError) {
          if (
            !(
              ZXingLib.NotFoundException &&
              singleError instanceof ZXingLib.NotFoundException
            )
          ) {
            throw singleError;
          }
        }
      }

      if (multiFormatReader && typeof multiFormatReader.reset === "function") {
        multiFormatReader.reset();
      }

      return results || [];
    };

    const decodeWithBinarizer = (BinarizerClass) => {
      if (typeof BinarizerClass !== "function") {
        return [];
      }

      const luminanceSource = createLuminanceSource();
      const binaryBitmap = new ZXingLib.BinaryBitmap(
        new BinarizerClass(luminanceSource)
      );

      return decodeWithBinaryBitmap(binaryBitmap);
    };

    let results = decodeWithBinarizer(ZXingLib.HybridBinarizer);

    if (
      (!results || results.length === 0) &&
      typeof ZXingLib.GlobalHistogramBinarizer === "function"
    ) {
      results = decodeWithBinarizer(ZXingLib.GlobalHistogramBinarizer);
    }

    if (
      (!results || results.length === 0) &&
      barcodeHints instanceof Map &&
      ZXingLib.DecodeHintType &&
      typeof ZXingLib.DecodeHintType.PURE_BARCODE !== "undefined"
    ) {
      const pureHints = new Map(barcodeHints);
      pureHints.set(ZXingLib.DecodeHintType.PURE_BARCODE, true);

      const pureReader = new ZXingLib.MultiFormatReader();
      pureReader.setHints(pureHints);

      try {
        const pureBinaryBitmap = new ZXingLib.BinaryBitmap(
          new ZXingLib.GlobalHistogramBinarizer(createLuminanceSource())
        );
        const pureResult = pureReader.decodeWithState(pureBinaryBitmap);
        if (pureResult) {
          results = [pureResult];
        }
      } catch (pureError) {
        if (
          !(
            ZXingLib.NotFoundException &&
            pureError instanceof ZXingLib.NotFoundException
          )
        ) {
          throw pureError;
        }
      } finally {
        if (typeof pureReader.reset === "function") {
          pureReader.reset();
        }
      }
    }

    if (
      (!results || results.length === 0) &&
      typeof ZXingLib.Code128Reader === "function" &&
      typeof ZXingLib.BitArray === "function"
    ) {
      const hintsForRows =
        barcodeHints instanceof Map ? new Map(barcodeHints) : new Map();
      if (
        ZXingLib.DecodeHintType &&
        typeof ZXingLib.DecodeHintType.TRY_HARDER !== "undefined"
      ) {
        hintsForRows.set(ZXingLib.DecodeHintType.TRY_HARDER, true);
      }

      const rowReaders = [new ZXingLib.Code128Reader()];

      const rowsToSample = [];
      const maxSamples = Math.min(processedHeight, 15);
      const centerRow = Math.floor(processedHeight / 2);
      rowsToSample.push(centerRow);
      const rowStep = Math.max(
        1,
        Math.floor(processedHeight / (maxSamples + 1))
      );
      for (
        let offset = rowStep;
        offset < processedHeight && rowsToSample.length < maxSamples;
        offset += rowStep
      ) {
        const upRow = centerRow - offset;
        const downRow = centerRow + offset;
        if (upRow >= 0) {
          rowsToSample.push(upRow);
        }
        if (downRow < processedHeight) {
          rowsToSample.push(downRow);
        }
      }

      const seenRows = new Set();
      const rowResults = [];

      for (let index = 0; index < rowsToSample.length; index += 1) {
        const row = rowsToSample[index];
        if (seenRows.has(row) || row < 0 || row >= processedHeight) {
          continue;
        }
        seenRows.add(row);

        const bitArray = new ZXingLib.BitArray(processedWidth);
        for (let x = 0; x < processedWidth; x += 1) {
          const pixel = data[(row * processedWidth + x) * 4];
          if (pixel === 0) {
            bitArray.set(x);
          }
        }

        for (
          let readerIndex = 0;
          readerIndex < rowReaders.length;
          readerIndex += 1
        ) {
          const rowReader = rowReaders[readerIndex];

          try {
            const rowResult = rowReader.decodeRow(row, bitArray, hintsForRows);
            if (rowResult) {
              rowResults.push(rowResult);
              break;
            }
          } catch (rowError) {
            if (
              !(
                (ZXingLib.NotFoundException &&
                  rowError instanceof ZXingLib.NotFoundException) ||
                (ZXingLib.FormatException &&
                  rowError instanceof ZXingLib.FormatException) ||
                (ZXingLib.ChecksumException &&
                  rowError instanceof ZXingLib.ChecksumException)
              )
            ) {
              throw rowError;
            }
          } finally {
            if (typeof rowReader.reset === "function") {
              rowReader.reset();
            }
          }
        }

        if (rowResults.length > 0) {
          results = rowResults;
          break;
        }
      }
    }

    const uniqueValues = [];
    results.forEach((result) => {
      const text = result.getText ? result.getText().trim() : "";
      if (text && !uniqueValues.includes(text)) {
        uniqueValues.push(text);
      }
    });

    return uniqueValues;
  } catch (error) {
    if (
      ZXingLib.NotFoundException &&
      error instanceof ZXingLib.NotFoundException
    ) {
      return [];
    }
    console.error("Barcode decoding failed", error);
    return [];
  } finally {
    if (multiFormatReader && typeof multiFormatReader.reset === "function") {
      multiFormatReader.reset();
    }
  }
}

/**
 * @param {...string[]} lists
 * @returns {string[]}
 */
function mergeUniqueValues(...lists) {
  const values = [];
  const seen = new Set();

  lists.forEach((entries) => {
    if (!entries) {
      return;
    }
    entries.forEach((value) => {
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      values.push(value);
    });
  });

  return values;
}

function scanCodesFromCanvas(canvas) {
  return mergeUniqueValues(
    scanQRCodesFromCanvas(canvas),
    scanBarcodesFromCanvas(canvas)
  );
}

function stopCapture() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (videoContainer) {
    videoContainer.classList.add("hidden");
  }
  if (videoPreview) {
    videoPreview.srcObject = null;
  }
}

function startScreenCapture() {
  if (stream) {
    return;
  }

  if (!canvasPreview || !videoPreview || !videoContainer) {
    return;
  }

  navigator.mediaDevices
    .getDisplayMedia({
      video: {
        displaySurface: "monitor",
      },
      audio: false,
    })
    .then((mediaStream) => {
      stream = mediaStream;
      videoPreview.srcObject = stream;
      videoContainer.classList.remove("hidden");

      videoPreview.addEventListener("loadedmetadata", () => {
        canvasPreview.width = videoPreview.videoWidth;
        canvasPreview.height = videoPreview.videoHeight;

        scanInterval = setInterval(() => {
          if (videoPreview.readyState === videoPreview.HAVE_ENOUGH_DATA) {
            const ctx = canvasPreview.getContext("2d");
            if (!ctx) {
              return;
            }
            ctx.drawImage(
              videoPreview,
              0,
              0,
              canvasPreview.width,
              canvasPreview.height
            );

            const values = scanCodesFromCanvas(canvasPreview);
            if (values.length > 0 && !valuesAreEqual(values, decodedValues)) {
              displayResults(values);
              stopCapture();
            }
          }
        }, 100);
      });

      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopCapture();
      });
    })
    .catch((error) => {
      let errorMessage = "Failed to capture screen.";
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        errorMessage =
          "Screen capture permission denied. Please allow screen sharing when prompted. All processing happens locally—no data is sent to any server.";
      } else if (error.name === "NotSupportedError") {
        errorMessage =
          "Screen capture is not supported in your browser. Please use Chrome, Firefox, or Edge, or use the file upload option instead.";
      } else {
        errorMessage = `Failed to capture screen: ${error.message}. Please ensure you grant screen sharing permissions.`;
      }
      showError(errorMessage);
    });
}

function handleFileUpload(event) {
  if (!fileInput) {
    return;
  }
  const target = /** @type {HTMLInputElement} */ (event.target);
  const file = target.files && target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        showError("Failed to read canvas context.");
        fileInput.value = "";
        return;
      }
      ctx.drawImage(img, 0, 0);

      const values = scanCodesFromCanvas(canvas);

      if (values.length > 0) {
        displayResults(values);
        fileInput.value = "";
      } else {
        showError(
          "No QR codes or barcodes found in the image. Please try another image."
        );
        fileInput.value = "";
      }
    };
    img.onerror = () => {
      showError("Failed to load image. Please try another file.");
      fileInput.value = "";
    };
    const result = e.target?.result;
    if (typeof result !== "string") {
      showError("Failed to decode image content.");
      fileInput.value = "";
      return;
    }
    img.src = result;
  };
  reader.onerror = () => {
    showError("Failed to read file. Please try another file.");
    fileInput.value = "";
  };
  reader.readAsDataURL(file);
}

if (stopCaptureBtn) {
  stopCaptureBtn.addEventListener("click", stopCapture);
}
if (fileInput) {
  fileInput.addEventListener("change", handleFileUpload);
}
if (resetBtn) {
  resetBtn.addEventListener("click", resetState);
}

if (captureBtn) {
  captureBtn.addEventListener("click", startScreenCapture);
}

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isInteractiveTarget =
    target instanceof Element &&
    target.matches("button, input, textarea");
  if (event.code === "Escape") {
    if (stream) {
      event.preventDefault();
      stopCapture();
    } else if (resultContainer && !resultContainer.classList.contains("hidden")) {
      event.preventDefault();
      resetState();
    }
  } else if (
    event.code === "Space" &&
    captureBtn &&
    !isInteractiveTarget
  ) {
    if (stream) {
      event.preventDefault();
      stopCapture();
    } else {
      event.preventDefault();
      captureBtn.focus();
      startScreenCapture();
    }
  }
});

if (fileInput) {
  fileInput.addEventListener("keydown", (event) => {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      fileInput.click();
    }
  });
}

const testHooks: RendererTestHooks = {
  copyToClipboard,
  displayResults,
  getMultipleBarcodeReader,
  isHttpUrl,
  mergeUniqueValues,
  resetBarcodeReaders,
  scanBarcodesFromCanvas,
  scanCodesFromCanvas,
  scanQRCodesFromCanvas,
  shareContent,
  valuesAreEqual,
};

if (typeof window !== "undefined") {
  window.__QRTY_TEST_HOOKS__ = testHooks;
} else if (typeof globalThis !== "undefined") {
  globalThis.__QRTY_TEST_HOOKS__ = testHooks;
}
