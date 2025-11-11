import type * as ZXingNs from "@zxing/library";
import type { ImageProcessingUtils as ImageProcessingUtilsModule } from "../utils/image-processing";

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

export type ImageProcessingUtils = ImageProcessingUtilsModule;

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
