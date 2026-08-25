import type { PreferredPanelSize } from "./types";

const IMAGE_VIEWER_CHROME_WIDTH = 24;
const IMAGE_VIEWER_CHROME_HEIGHT = 64;

const TEXT_VIEWER_CHROME_WIDTH = 44;
const TEXT_VIEWER_CHROME_HEIGHT = 118;
// Opening preference is computed before render, so text uses stable monospace
// metrics instead of DOM measurement or frame resize feedback.
const TEXT_VIEWER_CHARACTER_WIDTH = 7.6;
const TEXT_VIEWER_LINE_HEIGHT = 19.5;
const TEXT_VIEWER_MIN_CONTENT_COLUMNS = 32;
const TEXT_VIEWER_MIN_VISIBLE_LINES = 3;

export type ImageDimensions = {
  width: number;
  height: number;
};

export function preferredImageViewerSizeFromDimensions(
  dimensions: ImageDimensions | null | undefined,
): PreferredPanelSize | undefined {
  if (
    !dimensions ||
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return undefined;
  }

  return {
    width: dimensions.width + IMAGE_VIEWER_CHROME_WIDTH,
    height: dimensions.height + IMAGE_VIEWER_CHROME_HEIGHT,
  };
}

export function preferredTextViewerSizeFromContent(
  content: string,
): PreferredPanelSize {
  const lines = content.split(/\r\n|\r|\n/);
  const lineCount = Math.max(1, lines.length);
  const longestLine = lines.reduce(
    (max, line) => Math.max(max, line.length),
    0,
  );
  const columns = Math.max(TEXT_VIEWER_MIN_CONTENT_COLUMNS, longestLine);
  const visibleLines = Math.max(TEXT_VIEWER_MIN_VISIBLE_LINES, lineCount);

  return {
    width:
      Math.round(columns * TEXT_VIEWER_CHARACTER_WIDTH) +
      TEXT_VIEWER_CHROME_WIDTH,
    height:
      Math.round(visibleLines * TEXT_VIEWER_LINE_HEIGHT) +
      TEXT_VIEWER_CHROME_HEIGHT,
  };
}

export function imageDimensionsFromBase64(
  path: string,
  contentBase64: string,
): ImageDimensions | null {
  const bytes = bytesFromBase64(contentBase64);
  const lower = path.toLowerCase();

  if (lower.endsWith(".png")) return pngDimensions(bytes);
  if (lower.endsWith(".gif")) return gifDimensions(bytes);
  if (lower.endsWith(".webp")) return webpDimensions(bytes);
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return jpegDimensions(bytes);
  }
  if (lower.endsWith(".svg")) {
    return svgDimensionsFromText(textFromBytes(bytes));
  }

  return null;
}

function bytesFromBase64(contentBase64: string): Uint8Array {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function textFromBytes(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  return String.fromCharCode(...bytes);
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  return {
    width: readUint32Be(bytes, 16),
    height: readUint32Be(bytes, 20),
  };
}

function gifDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x47 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46
  ) {
    return null;
  }

  return {
    width: readUint16Le(bytes, 6),
    height: readUint16Le(bytes, 8),
  };
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return null;
  }

  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 " && bytes.length >= 30) {
    return {
      width: readUint16Le(bytes, 26) & 0x3fff,
      height: readUint16Le(bytes, 28) & 0x3fff,
    };
  }

  if (chunk === "VP8L" && bytes.length >= 25) {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }

  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + readUint24Le(bytes, 24),
      height: 1 + readUint24Le(bytes, 27),
    };
  }

  return null;
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 2 > bytes.length) return null;

    const length = readUint16Be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) return null;

    if (isJpegStartOfFrame(marker)) {
      return {
        height: readUint16Be(bytes, offset + 3),
        width: readUint16Be(bytes, offset + 5),
      };
    }

    offset += length;
  }

  return null;
}

function svgDimensionsFromText(text: string): ImageDimensions | null {
  const svgTag = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!svgTag) return null;

  const width = numericSvgAttribute(svgTag, "width");
  const height = numericSvgAttribute(svgTag, "height");
  if (width && height) return { width, height };

  const viewBox = svgTag.match(
    /\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i,
  );
  if (!viewBox) return null;

  return {
    width: Number(viewBox[1]),
    height: Number(viewBox[2]),
  };
}

function numericSvgAttribute(svgTag: string, name: string): number | null {
  const match = svgTag.match(
    new RegExp(`\\b${name}=["']\\s*([\\d.]+)`, "i"),
  );
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readUint16Be(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 256 + bytes[offset + 1];
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 256;
}

function readUint24Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
}

function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 16777216 +
    bytes[offset + 1] * 65536 +
    bytes[offset + 2] * 256 +
    bytes[offset + 3]
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
