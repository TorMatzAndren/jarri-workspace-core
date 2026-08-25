export type WorkspaceFileNodeKind =
  | "file"
  | "directory"
  | "symlink"
  | "other";

export type WorkspaceFileIconKind =
  | "folder-closed"
  | "folder-open"
  | "file"
  | "text"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "binary"
  | "config"
  | "symlink";

export type WorkspaceFileIconClassification = {
  name: string;
  nodeKind: WorkspaceFileNodeKind;
  expanded?: boolean;
  executable?: boolean;
};

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "log",
  "rst",
  "adoc",
  "tex",
  "rs",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "c",
  "h",
  "cc",
  "cpp",
  "cxx",
  "hpp",
  "hh",
  "java",
  "kt",
  "kts",
  "go",
  "lua",
  "rb",
  "php",
  "swift",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
]);

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "ico",
  "tif",
  "tiff",
]);

const AUDIO_EXTENSIONS = new Set([
  "wav",
  "flac",
  "mp3",
  "ogg",
  "oga",
  "opus",
  "m4a",
  "aac",
  "aiff",
  "aif",
  "mid",
  "midi",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mkv",
  "webm",
  "avi",
  "mov",
  "m4v",
  "mpg",
  "mpeg",
  "wmv",
]);

const ARCHIVE_EXTENSIONS = new Set([
  "zip",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "tbz",
  "tbz2",
  "xz",
  "txz",
  "7z",
  "rar",
  "zst",
]);

const CONFIG_EXTENSIONS = new Set([
  "json",
  "jsonc",
  "toml",
  "yaml",
  "yml",
  "ini",
  "conf",
  "cfg",
  "xml",
  "csv",
  "tsv",
  "sqlite",
  "sqlite3",
  "db",
  "sql",
  "env",
]);

const BINARY_EXTENSIONS = new Set([
  "bin",
  "dat",
  "so",
  "dll",
  "dylib",
  "exe",
  "msi",
  "appimage",
  "class",
  "jar",
  "o",
  "a",
  "wasm",
]);

function basename(name: string) {
  const normalized = name.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? normalized;
}

export function workspaceFileExtension(name: string): string {
  const base = basename(name).toLowerCase();

  if (
    base === ".bashrc" ||
    base === ".zshrc" ||
    base === ".profile" ||
    base === ".gitconfig" ||
    base === ".editorconfig"
  ) {
    return "config";
  }

  const index = base.lastIndexOf(".");

  if (index <= 0 || index === base.length - 1) {
    return "";
  }

  return base.slice(index + 1);
}

export function classifyWorkspaceFileIcon({
  name,
  nodeKind,
  expanded = false,
  executable = false,
}: WorkspaceFileIconClassification): WorkspaceFileIconKind {
  if (nodeKind === "directory") {
    return expanded ? "folder-open" : "folder-closed";
  }

  if (nodeKind === "symlink") {
    return "symlink";
  }

  if (nodeKind !== "file") {
    return "file";
  }

  if (executable) {
    return "binary";
  }

  const base = basename(name).toLowerCase();
  const extension = workspaceFileExtension(base);

  if (
    extension === "config" ||
    base === "dockerfile" ||
    base === "makefile" ||
    base === "cmakelists.txt" ||
    base.startsWith(".env")
  ) {
    return "config";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return "archive";
  }

  if (CONFIG_EXTENSIONS.has(extension)) {
    return "config";
  }

  if (BINARY_EXTENSIONS.has(extension)) {
    return "binary";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  return "file";
}
