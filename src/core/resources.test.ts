import {
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

console.log("workspace resource tests passed");
