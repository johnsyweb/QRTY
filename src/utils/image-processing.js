"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BARCODE_TARGET_MIN_DIMENSION = 600;
const BARCODE_MAX_SCALE_FACTOR = 8;
const BARCODE_MIN_QUIET_ZONE = 24;
const BARCODE_THICKENING_RATIO_THRESHOLD = 1.5;
function get2dContext(canvas) {
    if (!canvas || typeof canvas.getContext !== "function") {
        return null;
    }
    return (canvas.getContext("2d", { willReadFrequently: true }) ||
        canvas.getContext("2d"));
}
function getScaledCanvas(canvas, scaleFactor) {
    if (scaleFactor <= 1 ||
        typeof document === "undefined" ||
        typeof document.createElement !== "function") {
        return { canvas, context: get2dContext(canvas) };
    }
    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = Math.round(canvas.width * scaleFactor);
    scaledCanvas.height = Math.round(canvas.height * scaleFactor);
    const scaledContext = get2dContext(scaledCanvas);
    if (!scaledContext) {
        return { canvas, context: get2dContext(canvas) };
    }
    if (typeof scaledContext.imageSmoothingEnabled === "boolean") {
        scaledContext.imageSmoothingEnabled = false;
    }
    scaledContext.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
    return { canvas: scaledCanvas, context: scaledContext };
}
function addQuietZone(canvas) {
    if (!canvas ||
        typeof document === "undefined" ||
        typeof document.createElement !== "function") {
        return { canvas, context: get2dContext(canvas) };
    }
    const quietZone = Math.max(BARCODE_MIN_QUIET_ZONE, Math.round(Math.min(canvas.width, canvas.height) * 0.1));
    const paddedCanvas = document.createElement("canvas");
    paddedCanvas.width = canvas.width + quietZone * 2;
    paddedCanvas.height = canvas.height + quietZone * 2;
    const paddedContext = get2dContext(paddedCanvas);
    if (!paddedContext) {
        return { canvas, context: get2dContext(canvas) };
    }
    if (typeof paddedContext.imageSmoothingEnabled === "boolean") {
        paddedContext.imageSmoothingEnabled = false;
    }
    paddedContext.fillStyle = "#ffffff";
    paddedContext.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
    paddedContext.drawImage(canvas, quietZone, quietZone);
    return { canvas: paddedCanvas, context: paddedContext };
}
function normaliseImageData(imageData) {
    if (!imageData || !imageData.data) {
        return;
    }
    const { data } = imageData;
    let minLuminance = 255;
    let maxLuminance = 0;
    for (let index = 0; index < data.length; index += 4) {
        const luminance = data[index] * 0.2126 +
            data[index + 1] * 0.7152 +
            data[index + 2] * 0.0722;
        if (luminance < minLuminance) {
            minLuminance = luminance;
        }
        if (luminance > maxLuminance) {
            maxLuminance = luminance;
        }
    }
    const range = maxLuminance - minLuminance || 1;
    for (let index = 0; index < data.length; index += 4) {
        const luminance = data[index] * 0.2126 +
            data[index + 1] * 0.7152 +
            data[index + 2] * 0.0722;
        const normalised = Math.round(((luminance - minLuminance) / range) * 255);
        const clamped = Math.max(0, Math.min(255, normalised));
        data[index] = clamped;
        data[index + 1] = clamped;
        data[index + 2] = clamped;
        data[index + 3] = 255;
    }
}
function computeOtsuThreshold(histogram, totalPixels) {
    if (!totalPixels) {
        return 127;
    }
    let sumAll = 0;
    for (let index = 0; index < 256; index += 1) {
        sumAll += index * histogram[index];
    }
    let sumBackground = 0;
    let weightBackground = 0;
    let bestThreshold = 127;
    let maxVariance = 0;
    for (let threshold = 0; threshold < 256; threshold += 1) {
        weightBackground += histogram[threshold];
        if (weightBackground === 0) {
            continue;
        }
        const weightForeground = totalPixels - weightBackground;
        if (weightForeground === 0) {
            break;
        }
        sumBackground += threshold * histogram[threshold];
        const meanBackground = sumBackground / weightBackground;
        const meanForeground = (sumAll - sumBackground) / Math.max(weightForeground, 1);
        const betweenClassVariance = weightBackground *
            weightForeground *
            (meanBackground - meanForeground) *
            (meanBackground - meanForeground);
        if (betweenClassVariance > maxVariance) {
            maxVariance = betweenClassVariance;
            bestThreshold = threshold;
        }
    }
    return bestThreshold;
}
function binariseImageData(imageData) {
    if (!imageData || !imageData.data) {
        return;
    }
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    const histogram = new Uint32Array(256);
    for (let index = 0; index < data.length; index += 4) {
        histogram[data[index]] += 1;
    }
    const threshold = computeOtsuThreshold(histogram, totalPixels);
    for (let index = 0; index < data.length; index += 4) {
        const value = data[index] <= threshold ? 0 : 255;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 255;
    }
}
function thickenLinearFeatures(imageData) {
    if (!imageData || !imageData.data) {
        return;
    }
    const { data, width, height } = imageData;
    const source = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = (y * width + x) * 4;
            if (source[index] !== 0) {
                continue;
            }
            for (let offset = -1; offset <= 1; offset += 1) {
                const neighbourX = x + offset;
                if (neighbourX < 0 || neighbourX >= width) {
                    continue;
                }
                const neighbourIndex = (y * width + neighbourX) * 4;
                data[neighbourIndex] = 0;
                data[neighbourIndex + 1] = 0;
                data[neighbourIndex + 2] = 0;
                data[neighbourIndex + 3] = 255;
            }
        }
    }
}
function getBarcodeImagePayload(canvas) {
    if (!canvas) {
        return null;
    }
    const baseContext = get2dContext(canvas);
    if (!baseContext) {
        return null;
    }
    const { width, height } = canvas;
    if (!width || !height) {
        return null;
    }
    const minDimension = Math.min(width, height);
    const scaleFactor = minDimension > 0 && minDimension < BARCODE_TARGET_MIN_DIMENSION
        ? Math.min(BARCODE_MAX_SCALE_FACTOR, Math.max(1, Math.ceil(BARCODE_TARGET_MIN_DIMENSION / minDimension)))
        : 1;
    const { canvas: workingCanvas, context: workingContext } = getScaledCanvas(canvas, scaleFactor);
    if (!workingContext) {
        return null;
    }
    const { canvas: quietCanvas, context: quietContext } = addQuietZone(workingCanvas);
    if (!quietContext) {
        return null;
    }
    const imageData = quietContext.getImageData(0, 0, quietCanvas.width, quietCanvas.height);
    normaliseImageData(imageData);
    binariseImageData(imageData);
    if (quietCanvas.width / Math.max(quietCanvas.height, 1) >=
        BARCODE_THICKENING_RATIO_THRESHOLD) {
        thickenLinearFeatures(imageData);
    }
    return {
        data: imageData.data,
        width: quietCanvas.width,
        height: quietCanvas.height,
    };
}
const utils = {
    get2dContext,
    getScaledCanvas,
    addQuietZone,
    normaliseImageData,
    computeOtsuThreshold,
    binariseImageData,
    thickenLinearFeatures,
    getBarcodeImagePayload,
};
if (typeof window !== "undefined") {
    window.QRTY_IMAGE_UTILS =
        utils;
}
exports.default = utils;
