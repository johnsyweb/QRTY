export type RendererTestHooks = {
  mergeUniqueValues: (...lists: string[][]) => string[];
  isHttpUrl: (value: string) => boolean;
  displayResults: (values: string[]) => void;
  scanBarcodesFromCanvas: (canvas: HTMLCanvasElement) => string[];
  getMultipleBarcodeReader: () => unknown;
  scanCodesFromCanvas: (canvas: HTMLCanvasElement) => string[];
  scanQRCodesFromCanvas: (canvas: HTMLCanvasElement) => string[];
  shareContent: (...args: unknown[]) => Promise<void>;
  copyToClipboard: (...args: unknown[]) => Promise<void>;
  valuesAreEqual: (a: string[], b: string[]) => boolean;
  resetBarcodeReaders?: () => void;
};

declare global {
  interface Window {
    __QRTY_TEST_HOOKS__?: RendererTestHooks;
    ZXing?: unknown;
  }

  // eslint-disable-next-line no-var
  var jsQR: (...args: unknown[]) => unknown;
}

export {};
