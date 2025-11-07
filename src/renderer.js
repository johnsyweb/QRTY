const captureBtn = document.getElementById("capture-btn");
const fileInput = document.getElementById("file-input");
const videoContainer = document.getElementById("video-container");
const videoPreview = document.getElementById("video-preview");
const canvasPreview = document.getElementById("canvas-preview");
const stopCaptureBtn = document.getElementById("stop-capture-btn");
const resultContainer = document.getElementById("result-container");
const urlDisplay = document.getElementById("url-display");
const resetBtn = document.getElementById("reset-btn");
const errorContainer = document.getElementById("error-container");
const captureSupportNote = document.getElementById("capture-support-note");

let stream = null;
let scanInterval = null;
let decodedUrls = [];

if (captureSupportNote) {
  captureSupportNote.textContent =
    "Screen capture works best in modern desktop browsers. If it isn't supported on your device, please use the upload option instead.";
}

function showError(message) {
  errorContainer.textContent = message;
  errorContainer.classList.remove("hidden");
  errorContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => {
    errorContainer.classList.add("hidden");
  }, 5000);
}

function hideError() {
  errorContainer.classList.add("hidden");
}

function resetState() {
  resultContainer.classList.add("hidden");
  decodedUrls = [];
  urlDisplay.innerHTML = "";
  hideError();
  stopCapture();
}

function urlsAreEqual(a, b) {
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

async function shareContent(value, button, { isUrl } = {}) {
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

function displayUrls(values) {
  decodedUrls = values.slice();
  urlDisplay.innerHTML = "";

  values.forEach((value) => {
    const item = document.createElement("div");
    item.className = "url-item";

    const isUrl = isHttpUrl(value);

    let primaryContent;
    if (isUrl) {
      const link = document.createElement("a");
      link.href = value;
      link.textContent = value;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "url-link";
      primaryContent = link;
    } else {
      const text = document.createElement("pre");
      text.textContent = value;
      text.className = "url-text";
      primaryContent = text;
    }

    const actions = document.createElement("div");
    actions.className = "url-actions";

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
    urlDisplay.appendChild(item);
  });

  resultContainer.classList.remove("hidden");
  hideError();
}

function scanQRCodesFromCanvas(canvas) {
  const { width, height } = canvas;
  if (!width || !height) {
    return [];
  }

  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, width, height);
  const workingData = new Uint8ClampedArray(imageData.data);
  const results = [];
  const margin = 6;

  for (;;) {
    const code = jsQR(workingData, width, height, {
      inversionAttempts: "attemptBoth",
    });

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

function stopCapture() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  videoContainer.classList.add("hidden");
  videoPreview.srcObject = null;
}

function startScreenCapture() {
  if (stream) {
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
            ctx.drawImage(
              videoPreview,
              0,
              0,
              canvasPreview.width,
              canvasPreview.height
            );

            const values = scanQRCodesFromCanvas(canvasPreview);
            if (values.length > 0 && !urlsAreEqual(values, decodedUrls)) {
              displayUrls(values);
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
  const file = event.target.files[0];
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
      ctx.drawImage(img, 0, 0);

      const values = scanQRCodesFromCanvas(canvas);

      if (values.length > 0) {
        displayUrls(values);
        fileInput.value = "";
      } else {
        showError("No QR code found in image. Please try another image.");
        fileInput.value = "";
      }
    };
    img.onerror = () => {
      showError("Failed to load image. Please try another file.");
      fileInput.value = "";
    };
    img.src = e.target.result;
  };
  reader.onerror = () => {
    showError("Failed to read file. Please try another file.");
    fileInput.value = "";
  };
  reader.readAsDataURL(file);
}

stopCaptureBtn.addEventListener("click", stopCapture);
fileInput.addEventListener("change", handleFileUpload);
resetBtn.addEventListener("click", resetState);

if (captureBtn) {
  captureBtn.addEventListener("click", startScreenCapture);
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    if (stream) {
      event.preventDefault();
      stopCapture();
    } else if (!resultContainer.classList.contains("hidden")) {
      event.preventDefault();
      resetState();
    }
  } else if (
    event.code === "Space" &&
    !event.target.matches("button, input, textarea")
  ) {
    if (stream) {
      event.preventDefault();
      stopCapture();
    } else if (captureBtn) {
      event.preventDefault();
      captureBtn.focus();
      startScreenCapture();
    }
  }
});

fileInput.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "Space") {
    event.preventDefault();
    fileInput.click();
  }
});
