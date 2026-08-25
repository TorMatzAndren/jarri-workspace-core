import {
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
