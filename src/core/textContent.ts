export const TEXT_CONTENT_PROBE_BYTE_LIMIT = 64 * 1024;

export function bytesFromBase64(contentBase64: string): Uint8Array {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function decodeUtf8(
  bytes: Uint8Array,
  truncated: boolean,
): string | null {
  const decoder = new TextDecoder("utf-8", { fatal: true });

  try {
    return decoder.decode(bytes);
  } catch {
    if (!truncated) {
      return null;
    }
  }

  // A bounded probe may end in the middle of one UTF-8 scalar.
  // UTF-8 scalars are at most four bytes, so only the final three
  // bytes may need to be discarded to distinguish probe truncation
  // from genuinely invalid UTF-8.
  for (let trailingBytes = 1; trailingBytes <= 3; trailingBytes += 1) {
    if (bytes.length <= trailingBytes) {
      break;
    }

    try {
      return decoder.decode(bytes.subarray(0, bytes.length - trailingBytes));
    } catch {
      // Continue looking only across the possible truncated UTF-8 tail.
    }
  }

  return null;
}

export function textContentLooksLikeUtf8(
  bytes: Uint8Array,
  truncated = false,
): boolean {
  if (bytes.length === 0) {
    return true;
  }

  // NUL is a strong binary signal and should never be projected as
  // ordinary Workspace text.
  if (bytes.includes(0)) {
    return false;
  }

  const text = decodeUtf8(bytes, truncated);

  if (text === null) {
    return false;
  }

  let controlCount = 0;
  let scalarCount = 0;

  for (const character of text) {
    scalarCount += 1;
    const codePoint = character.codePointAt(0) ?? 0;

    // TAB, LF and CR are ordinary textual whitespace.
    if (
      (codePoint >= 0x00 && codePoint < 0x20) &&
      codePoint !== 0x09 &&
      codePoint !== 0x0a &&
      codePoint !== 0x0d
    ) {
      controlCount += 1;
    }
  }

  if (scalarCount === 0) {
    return true;
  }

  // A small amount of control content can occur in otherwise useful
  // textual evidence, but control-heavy content is not an ordinary
  // text resource.
  return controlCount / scalarCount <= 0.01;
}

export function base64ContentLooksLikeUtf8Text(
  contentBase64: string,
  truncated = false,
): boolean {
  try {
    return textContentLooksLikeUtf8(
      bytesFromBase64(contentBase64),
      truncated,
    );
  } catch {
    return false;
  }
}
