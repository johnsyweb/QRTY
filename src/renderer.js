const captureBtn = document.getElementById("capture-btn");
const fileInput = document.getElementById("file-input");
const videoContainer = document.getElementById("video-container");
const videoPreview = document.getElementById("video-preview");
const canvasPreview = document.getElementById("canvas-preview");
const stopCaptureBtn = document.getElementById("stop-capture-btn");
const resultContainer = document.getElementById("result-container");
const urlDisplay = document.getElementById("url-display");
const openBtn = document.getElementById("open-btn");
const copyBtn = document.getElementById("copy-btn");
const resetBtn = document.getElementById("reset-btn");
const errorContainer = document.getElementById("error-container");

let stream = null;
let scanInterval = null;
let decodedUrl = null;

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
  decodedUrl = null;
  hideError();
  stopCapture();
}

function displayUrl(url) {
  decodedUrl = url;
  urlDisplay.textContent = url;
  resultContainer.classList.remove("hidden");
  hideError();
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

function scanQRCodeFromCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);

  if (code) {
    displayUrl(code.data);
    stopCapture();
    return true;
  }
  return false;
}

function startScreenCapture() {
  if (stream) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showError(
      "Screen capture is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge, or use the file upload option."
    );
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
            scanQRCodeFromCanvas(canvasPreview);
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

      if (scanQRCodeFromCanvas(canvas)) {
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

captureBtn.addEventListener("click", startScreenCapture);
stopCaptureBtn.addEventListener("click", stopCapture);
fileInput.addEventListener("change", handleFileUpload);
resetBtn.addEventListener("click", resetState);

openBtn.addEventListener("click", () => {
  if (decodedUrl) {
    window.open(decodedUrl, "_blank");
  }
});

copyBtn.addEventListener("click", async () => {
  if (decodedUrl) {
    try {
      await navigator.clipboard.writeText(decodedUrl);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (error) {
      showError("Failed to copy URL to clipboard");
    }
  }
});

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
    event.preventDefault();
    if (stream) {
      stopCapture();
    } else {
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
