import type { ImageProcessingUtils } from "../types/renderer-hooks";

const utils = require("../utils/image-processing.ts")
  .default as ImageProcessingUtils;

describe("image processing utils", () => {
  test("normaliseImageData stretches luminance range", () => {
    const data = new Uint8ClampedArray([10, 10, 10, 255, 200, 200, 200, 255]);
    const imageData = {
      data,
      width: 1,
      height: 2,
    } as unknown as ImageData;

    utils.normaliseImageData(imageData);

    expect(Array.from(imageData.data.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(imageData.data.slice(4, 8))).toEqual([
      255, 255, 255, 255,
    ]);
  });

  test("computeOtsuThreshold prefers balanced split", () => {
    const histogram = new Uint32Array(256);
    for (let i = 0; i < 128; i += 1) {
      histogram[i] = 10;
    }
    for (let i = 128; i < 256; i += 1) {
      histogram[i] = 30;
    }

    const threshold = utils.computeOtsuThreshold(histogram, 256 * 20);

    expect(threshold).toBeGreaterThanOrEqual(120);
    expect(threshold).toBeLessThan(140);
  });

  test("binariseImageData converts pixels to black or white", () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, 120, 120, 120, 255, 240, 240, 240, 255,
    ]);
    const imageData = {
      data,
      width: 1,
      height: 3,
    } as unknown as ImageData;

    utils.binariseImageData(imageData);

    const channels: number[] = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
      channels.push(imageData.data[i]);
    }
    const unique = new Set(channels);
    expect(unique.has(0)).toBe(true);
    expect(unique.has(255)).toBe(true);
  });

  test("thickenLinearFeatures spreads dark pixels to neighbours", () => {
    const width = 5;
    const height = 1;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
    // Set a single black pixel in the middle
    data[2 * 4] = 0;
    data[2 * 4 + 1] = 0;
    data[2 * 4 + 2] = 0;

    const imageData = {
      data,
      width,
      height,
    } as unknown as ImageData;

    utils.thickenLinearFeatures(imageData);

    const blackChannels = [];
    for (let i = 0; i < width; i += 1) {
      blackChannels.push(imageData.data[i * 4]);
    }
    expect(blackChannels[1]).toBe(0);
    expect(blackChannels[2]).toBe(0);
    expect(blackChannels[3]).toBe(0);
  });
});
