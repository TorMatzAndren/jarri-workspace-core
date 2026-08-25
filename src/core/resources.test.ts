import {
  base64ContentLooksLikeUtf8Text,
  textContentLooksLikeUtf8,
} from "./textContent";
import {
  explicitTextViewerResourcePath,
  filePathBasename,
  filePathToResourceUri,
  isImageFilePath,
  isTextFilePath,
  resourceUriToFilePath,
  resourceUriToImageFilePath,
  resourceUriToTextFilePath,
} from "./resources";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

assertEqual(
  filePathToResourceUri("/home/dretski/a file.png"),
  "file:///home/dretski/a%20file.png",
  "file path encodes to resource URI",
);

assertEqual(
  resourceUriToFilePath("file:///home/dretski/a%20file.png"),
  "/home/dretski/a file.png",
  "file resource URI decodes to path",
);

assertEqual(isImageFilePath("/tmp/photo.JPG"), true, "jpg is an image path");
assertEqual(isImageFilePath("/tmp/readme.md"), false, "markdown is not an image path");
assertEqual(isTextFilePath("/tmp/readme.md"), true, "markdown is a text path");
assertEqual(isTextFilePath("/tmp/source.tsx"), true, "tsx is a source text path");
assertEqual(isTextFilePath("/tmp/README"), true, "README is conventional extensionless text");
assertEqual(isTextFilePath("/tmp/LICENSE"), true, "LICENSE is conventional extensionless text");
assertEqual(isTextFilePath("/tmp/Makefile"), true, "Makefile remains conventional extensionless text");
assertEqual(isTextFilePath("/tmp/Dockerfile"), true, "Dockerfile remains conventional extensionless text");
assertEqual(
  isTextFilePath("/tmp/arbitrary-extensionless-file"),
  false,
  "arbitrary extensionless files are not assumed to be text",
);
assertEqual(isTextFilePath("/tmp/photo.png"), false, "image is not a text path");

assertEqual(
  resourceUriToImageFilePath("file:///tmp/photo.webp"),
  "/tmp/photo.webp",
  "image resource URI resolves to file path",
);

assertEqual(
  resourceUriToImageFilePath("file:///tmp/readme.md"),
  null,
  "non-image file resource is not an image opener",
);

assertEqual(
  resourceUriToTextFilePath("file:///tmp/readme.md"),
  "/tmp/readme.md",
  "text resource URI resolves to file path",
);

assertEqual(
  filePathBasename("/tmp/nested/photo.png"),
  "photo.png",
  "basename is derived from file path",
);

assertEqual(
  explicitTextViewerResourcePath({
    uri: filePathToResourceUri("/tmp/arbitrary-extensionless-file"),
    preferredModuleId: "core",
    preferredPanelType: "text-viewer",
  }),
  "/tmp/arbitrary-extensionless-file",
  "explicit Core text viewer request accepts an unclassified file resource",
);

assertEqual(
  explicitTextViewerResourcePath({
    uri: filePathToResourceUri("/tmp/photo.png"),
    preferredModuleId: "core",
    preferredPanelType: "text-viewer",
  }),
  null,
  "explicit text viewer request does not override known image classification",
);

assertEqual(
  explicitTextViewerResourcePath({
    uri: filePathToResourceUri("/tmp/arbitrary-extensionless-file"),
    preferredModuleId: "core",
    preferredPanelType: "image-viewer",
  }),
  null,
  "unclassified file is not admitted by unrelated explicit viewer requests",
);

assertEqual(
  explicitTextViewerResourcePath({
    uri: "https://example.invalid/readme" as ReturnType<typeof filePathToResourceUri>,
    preferredModuleId: "core",
    preferredPanelType: "text-viewer",
  }),
  null,
  "explicit text viewer exception remains limited to file resources",
);

assertEqual(
  textContentLooksLikeUtf8(new TextEncoder().encode("plain extensionless text\nwith another line")),
  true,
  "ordinary UTF-8 content is text",
);

assertEqual(
  textContentLooksLikeUtf8(new Uint8Array()),
  true,
  "empty file is valid text content",
);

assertEqual(
  textContentLooksLikeUtf8(new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01])),
  false,
  "ELF-like content containing NUL is binary",
);

assertEqual(
  textContentLooksLikeUtf8(new Uint8Array([0xff, 0xfe, 0xfd])),
  false,
  "invalid UTF-8 content is not text",
);

assertEqual(
  textContentLooksLikeUtf8(new Uint8Array([0x68, 0xc3]), true),
  true,
  "probe ending inside a UTF-8 scalar may discard only its truncated tail",
);

assertEqual(
  textContentLooksLikeUtf8(new Uint8Array([0x68, 0xc3]), false),
  false,
  "invalid UTF-8 in a complete sample is rejected",
);

assertEqual(
  base64ContentLooksLikeUtf8Text("aGVsbG8Kd29ybGQ="),
  true,
  "base64 UTF-8 text probe is accepted",
);

console.log("workspace resource tests passed");
