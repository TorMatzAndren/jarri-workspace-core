import {
  classifyWorkspaceFile,
  classifyWorkspaceFileIcon,
  workspaceFileExtension,
} from "./fileIcons";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

assertEqual(
  classifyWorkspaceFileIcon({
    name: "/tmp/folder",
    nodeKind: "directory",
  }),
  "folder-closed",
  "closed directory",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "/tmp/folder",
    nodeKind: "directory",
    expanded: true,
  }),
  "folder-open",
  "open directory",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "photo.PNG",
    nodeKind: "file",
  }),
  "image",
  "image extension is case insensitive",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "song.flac",
    nodeKind: "file",
  }),
  "audio",
  "audio classification",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "movie.mkv",
    nodeKind: "file",
  }),
  "video",
  "video classification",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "archive.tar.gz",
    nodeKind: "file",
  }),
  "archive",
  "archive classification uses final extension",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "main.tsx",
    nodeKind: "file",
  }),
  "text",
  "source file classification",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "settings.toml",
    nodeKind: "file",
  }),
  "config",
  "config classification",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: ".bashrc",
    nodeKind: "file",
  }),
  "config",
  "known dotfile classification",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "program",
    nodeKind: "file",
    executable: true,
  }),
  "binary",
  "executable classification",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "link",
    nodeKind: "symlink",
  }),
  "symlink",
  "symlink classification",
);

assertEqual(
  classifyWorkspaceFileIcon({
    name: "unknown.xyzzy",
    nodeKind: "file",
  }),
  "file",
  "unknown extension falls back to generic file",
);

assertEqual(
  workspaceFileExtension("/tmp/thing.TS"),
  "ts",
  "extension normalization",
);

assertEqual(
  workspaceFileExtension("/tmp/no-extension"),
  "",
  "extensionless path",
);

console.log("workspace file icon classification tests passed");


function assertDisplayType(
  name: string,
  expected: string,
  executable = false,
) {
  const actual = classifyWorkspaceFile({
    name,
    nodeKind: "file",
    executable,
  }).displayType;

  if (actual !== expected) {
    throw new Error(
      `Expected ${name} to display as "${expected}", got "${actual}".`,
    );
  }
}

assertDisplayType("README.md", "Markdown");
assertDisplayType("image.png", "PNG picture");
assertDisplayType("diagram.svg", "SVG picture");
assertDisplayType("document.pdf", "PDF");
assertDisplayType("config.xml", "XML");
assertDisplayType("data.json", "JSON");
assertDisplayType("settings.yaml", "YAML");
assertDisplayType("Cargo.toml", "Rust manifest");
assertDisplayType("package.json", "Node package manifest");
assertDisplayType("main.rs", "Rust");
assertDisplayType("WorkspaceCanvas.tsx", "TypeScript React");
assertDisplayType("archive.zip", "ZIP archive");
assertDisplayType("discord.deb", "Debian package");
assertDisplayType("EQ_setup.exe", "Windows executable");
assertDisplayType("unknown.weirdextension", "File");

const folderClassification = classifyWorkspaceFile({
  name: "/tmp/example",
  nodeKind: "directory",
});

if (folderClassification.displayType !== "Folder") {
  throw new Error(
    `Expected directory display type Folder, got ${folderClassification.displayType}.`,
  );
}

const symlinkClassification = classifyWorkspaceFile({
  name: "/tmp/link",
  nodeKind: "symlink",
  targetKind: "directory",
});

if (symlinkClassification.displayType !== "Folder symlink") {
  throw new Error(
    `Expected directory symlink display type Folder symlink, got ${symlinkClassification.displayType}.`,
  );
}

console.log("workspace file semantic classification tests passed");
