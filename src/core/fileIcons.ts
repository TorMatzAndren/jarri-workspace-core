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


export type WorkspaceFileSemanticFamily =
  | "folder"
  | "text"
  | "structured-data"
  | "code"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "package"
  | "executable"
  | "config"
  | "binary"
  | "symlink"
  | "other";

export type WorkspaceFileClassification = {
  iconKind: WorkspaceFileIconKind;
  family: WorkspaceFileSemanticFamily;
  displayType: string;
};

type WorkspaceFileClassificationInput = {
  name: string;
  nodeKind: "directory" | "file" | "symlink" | "other";
  targetKind?: "directory" | "file" | "symlink" | "other" | null;
  expanded?: boolean;
  executable?: boolean;
};

const FILE_TYPE_BY_EXTENSION: Record<
  string,
  Pick<WorkspaceFileClassification, "family" | "displayType">
> = {
  // Images.
  png: { family: "image", displayType: "PNG picture" },
  jpg: { family: "image", displayType: "JPEG picture" },
  jpeg: { family: "image", displayType: "JPEG picture" },
  webp: { family: "image", displayType: "WebP picture" },
  gif: { family: "image", displayType: "GIF picture" },
  bmp: { family: "image", displayType: "Bitmap picture" },
  svg: { family: "image", displayType: "SVG picture" },
  avif: { family: "image", displayType: "AVIF picture" },
  ico: { family: "image", displayType: "Icon image" },
  tif: { family: "image", displayType: "TIFF picture" },
  tiff: { family: "image", displayType: "TIFF picture" },

  // Documents and text.
  txt: { family: "text", displayType: "Text" },
  log: { family: "text", displayType: "Log" },
  md: { family: "text", displayType: "Markdown" },
  markdown: { family: "text", displayType: "Markdown" },
  rst: { family: "text", displayType: "reStructuredText" },
  pdf: { family: "text", displayType: "PDF" },
  csv: { family: "structured-data", displayType: "CSV" },
  tsv: { family: "structured-data", displayType: "TSV" },

  // Structured data and configuration.
  json: { family: "structured-data", displayType: "JSON" },
  jsonc: { family: "structured-data", displayType: "JSON with comments" },
  xml: { family: "structured-data", displayType: "XML" },
  yaml: { family: "structured-data", displayType: "YAML" },
  yml: { family: "structured-data", displayType: "YAML" },
  toml: { family: "config", displayType: "TOML" },
  ini: { family: "config", displayType: "INI config" },
  cfg: { family: "config", displayType: "Config" },
  conf: { family: "config", displayType: "Config" },
  env: { family: "config", displayType: "Environment config" },

  // Source code.
  ts: { family: "code", displayType: "TypeScript" },
  tsx: { family: "code", displayType: "TypeScript React" },
  js: { family: "code", displayType: "JavaScript" },
  jsx: { family: "code", displayType: "JavaScript React" },
  mjs: { family: "code", displayType: "JavaScript module" },
  cjs: { family: "code", displayType: "CommonJS" },
  rs: { family: "code", displayType: "Rust" },
  py: { family: "code", displayType: "Python" },
  sh: { family: "code", displayType: "Shell script" },
  bash: { family: "code", displayType: "Bash script" },
  zsh: { family: "code", displayType: "Zsh script" },
  fish: { family: "code", displayType: "Fish script" },
  c: { family: "code", displayType: "C source" },
  h: { family: "code", displayType: "C header" },
  cc: { family: "code", displayType: "C++ source" },
  cpp: { family: "code", displayType: "C++ source" },
  cxx: { family: "code", displayType: "C++ source" },
  hpp: { family: "code", displayType: "C++ header" },
  cs: { family: "code", displayType: "C#" },
  java: { family: "code", displayType: "Java" },
  kt: { family: "code", displayType: "Kotlin" },
  go: { family: "code", displayType: "Go" },
  php: { family: "code", displayType: "PHP" },
  rb: { family: "code", displayType: "Ruby" },
  lua: { family: "code", displayType: "Lua" },
  sql: { family: "code", displayType: "SQL" },
  css: { family: "code", displayType: "CSS" },
  scss: { family: "code", displayType: "SCSS" },
  html: { family: "code", displayType: "HTML" },
  htm: { family: "code", displayType: "HTML" },

  // Audio.
  mp3: { family: "audio", displayType: "MP3 audio" },
  wav: { family: "audio", displayType: "WAV audio" },
  flac: { family: "audio", displayType: "FLAC audio" },
  ogg: { family: "audio", displayType: "Ogg audio" },
  opus: { family: "audio", displayType: "Opus audio" },
  m4a: { family: "audio", displayType: "M4A audio" },
  aac: { family: "audio", displayType: "AAC audio" },

  // Video.
  mp4: { family: "video", displayType: "MP4 video" },
  mkv: { family: "video", displayType: "Matroska video" },
  webm: { family: "video", displayType: "WebM video" },
  avi: { family: "video", displayType: "AVI video" },
  mov: { family: "video", displayType: "QuickTime video" },
  m4v: { family: "video", displayType: "M4V video" },
  mpg: { family: "video", displayType: "MPEG video" },
  mpeg: { family: "video", displayType: "MPEG video" },

  // Archives.
  zip: { family: "archive", displayType: "ZIP archive" },
  tar: { family: "archive", displayType: "TAR archive" },
  gz: { family: "archive", displayType: "GZip archive" },
  tgz: { family: "archive", displayType: "GZip TAR archive" },
  bz2: { family: "archive", displayType: "BZip2 archive" },
  xz: { family: "archive", displayType: "XZ archive" },
  "7z": { family: "archive", displayType: "7-Zip archive" },
  rar: { family: "archive", displayType: "RAR archive" },

  // Installable packages.
  deb: { family: "package", displayType: "Debian package" },
  rpm: { family: "package", displayType: "RPM package" },
  apk: { family: "package", displayType: "Package" },

  // Executables and binary modules.
  exe: { family: "executable", displayType: "Windows executable" },
  msi: { family: "executable", displayType: "Windows installer" },
  appimage: { family: "executable", displayType: "AppImage" },
  bin: { family: "binary", displayType: "Binary" },
  so: { family: "binary", displayType: "Shared library" },
  dll: { family: "binary", displayType: "Windows library" },
  dylib: { family: "binary", displayType: "Dynamic library" },
  wasm: { family: "binary", displayType: "WebAssembly" },
  o: { family: "binary", displayType: "Object file" },
  a: { family: "binary", displayType: "Static library" },

  // Databases.
  db: { family: "structured-data", displayType: "Database" },
  sqlite: { family: "structured-data", displayType: "SQLite database" },
  sqlite3: { family: "structured-data", displayType: "SQLite database" },
};

const SPECIAL_FILE_TYPES: Record<
  string,
  Pick<WorkspaceFileClassification, "family" | "displayType">
> = {
  dockerfile: { family: "config", displayType: "Dockerfile" },
  makefile: { family: "config", displayType: "Makefile" },
  "cargo.toml": { family: "config", displayType: "Rust manifest" },
  "cargo.lock": { family: "structured-data", displayType: "Rust lockfile" },
  "package.json": { family: "config", displayType: "Node package manifest" },
  "package-lock.json": { family: "structured-data", displayType: "Node lockfile" },
  "pnpm-lock.yaml": { family: "structured-data", displayType: "PNPM lockfile" },
  "yarn.lock": { family: "structured-data", displayType: "Yarn lockfile" },
  "tsconfig.json": { family: "config", displayType: "TypeScript config" },
  ".gitignore": { family: "config", displayType: "Git ignore" },
  ".gitattributes": { family: "config", displayType: "Git attributes" },
  ".gitmodules": { family: "config", displayType: "Git modules" },
  ".gitconfig": { family: "config", displayType: "Git config" },
  ".editorconfig": { family: "config", displayType: "Editor config" },
  ".env": { family: "config", displayType: "Environment config" },
};

function workspaceFileBasename(name: string) {
  const normalized = name.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
}

function iconKindForSemanticFamily(
  family: WorkspaceFileSemanticFamily,
  fallback: WorkspaceFileIconKind,
): WorkspaceFileIconKind {
  switch (family) {
    case "folder":
      return fallback;
    case "text":
    case "code":
      return "text";
    case "structured-data":
    case "config":
      return "config";
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "archive":
    case "package":
      return "archive";
    case "executable":
    case "binary":
      return "binary";
    case "symlink":
      return "symlink";
    case "other":
      return fallback;
  }
}

export function classifyWorkspaceFile(
  input: WorkspaceFileClassificationInput,
): WorkspaceFileClassification {
  const fallbackIcon = classifyWorkspaceFileIcon(input);

  if (input.nodeKind === "directory") {
    return {
      iconKind: fallbackIcon,
      family: "folder",
      displayType: "Folder",
    };
  }

  if (input.nodeKind === "symlink") {
    const displayType =
      input.targetKind === "directory"
        ? "Folder symlink"
        : input.targetKind === "file"
          ? "File symlink"
          : "Symlink";

    return {
      iconKind: "symlink",
      family: "symlink",
      displayType,
    };
  }

  if (input.nodeKind !== "file") {
    return {
      iconKind: fallbackIcon,
      family: "other",
      displayType: "Other",
    };
  }

  const basename = workspaceFileBasename(input.name);

  const special = SPECIAL_FILE_TYPES[basename];
  if (special) {
    return {
      ...special,
      iconKind: iconKindForSemanticFamily(special.family, fallbackIcon),
    };
  }

  const extension = workspaceFileExtension(input.name);
  const byExtension = FILE_TYPE_BY_EXTENSION[extension];

  if (byExtension) {
    return {
      ...byExtension,
      iconKind: iconKindForSemanticFamily(byExtension.family, fallbackIcon),
    };
  }

  if (input.executable) {
    return {
      iconKind: "binary",
      family: "executable",
      displayType: "Executable",
    };
  }

  return {
    iconKind: fallbackIcon,
    family: "other",
    displayType: "File",
  };
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
