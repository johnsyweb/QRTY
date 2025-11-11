import type * as ZXingNs from "@zxing/library";

export type ZXingMultipleReader = {
  decodeMultiple: (bitmap: ZXingNs.BinaryBitmap) => ZXingNs.Result[];
  reset?: () => void;
};

export type ZXingModule = typeof ZXingNs & {
  GenericMultipleBarcodeReader?: new (
    reader: InstanceType<typeof ZXingNs.MultiFormatReader>
  ) => ZXingMultipleReader;
};

export type ZXingDecodeHintType = ZXingNs.DecodeHintType;

export type ImageProcessingUtils = {
  get2dContext: (
    canvas: HTMLCanvasElement | OffscreenCanvas | null
  ) => CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  getScaledCanvas: (
    canvas: HTMLCanvasElement,
    scaleFactor: number
  ) => {
    canvas: HTMLCanvasElement;
    context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
  };
  addQuietZone: (
    canvas: HTMLCanvasElement
  ) => {
    canvas: HTMLCanvasElement;
    context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
  };
  normaliseImageData: (imageData: ImageData) => void;
  computeOtsuThreshold: (histogram: Uint32Array, totalPixels: number) => number;
  binariseImageData: (imageData: ImageData) => void;
  thickenLinearFeatures: (imageData: ImageData) => void;
  getBarcodeImagePayload: (
    canvas: HTMLCanvasElement
  ) => { data: Uint8ClampedArray; width: number; height: number } | null;
};

export type RendererTestHooks = {
  mergeUniqueValues: (...lists: string[][]) => string[];
  isHttpUrl: (value: string) => boolean;
  displayResults: (values: string[]) => void;
  scanBarcodesFromCanvas: (canvas: HTMLCanvasElement) => string[];
  getMultipleBarcodeReader: () => ZXingMultipleReader | null;
  scanCodesFromCanvas: (canvas: HTMLCanvasElement) => string[];
  scanQRCodesFromCanvas: (canvas: HTMLCanvasElement) => string[];
  shareContent: (
    value: string,
    button: HTMLButtonElement,
    options?: { isUrl?: boolean }
  ) => Promise<void>;
  copyToClipboard: (
    value: string,
    button: HTMLButtonElement
  ) => Promise<void>;
  valuesAreEqual: (a: string[], b: string[]) => boolean;
  resetBarcodeReaders?: () => void;
};

declare global {
  interface Window {
    __QRTY_TEST_HOOKS__?: RendererTestHooks;
    ZXing?: ZXingModule;
    QRTY_IMAGE_UTILS?: ImageProcessingUtils;
  }

  // eslint-disable-next-line no-var
  var jsQR: (...args: unknown[]) => unknown;
}

export {};
