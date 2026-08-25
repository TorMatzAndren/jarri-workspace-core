import type { ReactNode } from "react";
import type { WorkspaceFileIconKind } from "./fileIcons";

export type FileTypeIconProps = {
  kind: WorkspaceFileIconKind;
  className?: string;
  title?: string;
};

type IconSvgProps = {
  children: ReactNode;
};

function IconSvg({ children }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      focusable="false"
      aria-hidden="true"
      className="workspace-file-icon__svg"
    >
      {children}
    </svg>
  );
}

function FolderClosedIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__secondary"
        d="M1.75 5.25h5.1l1.45 1.6h7.95v7.25a1.4 1.4 0 0 1-1.4 1.4H3.15a1.4 1.4 0 0 1-1.4-1.4Z"
      />
      <path
        className="workspace-file-icon__primary"
        d="M1.75 5.25V3.9a1.4 1.4 0 0 1 1.4-1.4H6.1l1.55 1.75h7.2a1.4 1.4 0 0 1 1.4 1.4v1.2H8.3l-1.45-1.6Z"
      />
    </IconSvg>
  );
}

function FolderOpenIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__secondary"
        d="M2 6V4.05A1.35 1.35 0 0 1 3.35 2.7H6.2l1.5 1.65h6.95A1.35 1.35 0 0 1 16 5.7V7"
      />
      <path
        className="workspace-file-icon__primary"
        d="M2.2 7h14.15l-2.05 7.1a1.55 1.55 0 0 1-1.5 1.15H3.45a1.45 1.45 0 0 1-1.4-1.85Z"
      />
    </IconSvg>
  );
}

function GenericFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14M6.3 9h5.4M6.3 11.5h5.4"
      />
    </IconSvg>
  );
}

function TextFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14M6.1 8h5.8M6.1 10.25h5.8M6.1 12.5h4.2"
      />
    </IconSvg>
  );
}

function ImageFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14M5.8 13.4l2.45-2.65 1.65 1.7 1.25-1.2 1.2 1.35"
      />
      <circle
        className="workspace-file-icon__secondary workspace-file-icon__dot"
        cx="7.1"
        cy="7.6"
        r="1.05"
      />
    </IconSvg>
  );
}

function AudioFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14M10.8 7.25v5.05M10.8 7.25l2.1-.55v4.75"
      />
      <ellipse
        className="workspace-file-icon__secondary workspace-file-icon__dot"
        cx="9.35"
        cy="12.75"
        rx="1.45"
        ry="1.05"
      />
      <ellipse
        className="workspace-file-icon__secondary workspace-file-icon__dot"
        cx="11.45"
        cy="11.85"
        rx="1.45"
        ry="1.05"
      />
    </IconSvg>
  );
}

function VideoFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14"
      />
      <path
        className="workspace-file-icon__secondary workspace-file-icon__filled"
        d="m7.1 8.15 4.45 2.45-4.45 2.45Z"
      />
    </IconSvg>
  );
}

function ArchiveFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14M7.1 3.2h2M7.1 5.2h2M7.1 7.2h2M7.1 9.2h2M7.1 11.2h2"
      />
      <rect
        className="workspace-file-icon__secondary"
        x="6.65"
        y="12.3"
        width="2.9"
        height="1.75"
        rx=".4"
      />
    </IconSvg>
  );
}

function BinaryFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14M6.25 8.25h1.5v4h-1.5M10.25 8.25h1.5v4h-1.5M8.8 7.55v5.4"
      />
    </IconSvg>
  );
}

function ConfigFileIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14"
      />
      <circle
        className="workspace-file-icon__secondary"
        cx="9"
        cy="10.3"
        r="2.15"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M9 6.9v1.25M9 12.45v1.25M5.6 10.3h1.25M11.15 10.3h1.25M6.6 7.9l.9.9M10.5 11.8l.9.9M11.4 7.9l-.9.9M7.5 11.8l-.9.9"
      />
    </IconSvg>
  );
}

function SymlinkIcon() {
  return (
    <IconSvg>
      <path
        className="workspace-file-icon__primary"
        d="M4 1.75h6.2L14 5.55v10.7H4Z"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M10.2 1.75v3.8H14"
      />
      <path
        className="workspace-file-icon__secondary"
        d="M6 12.75c0-2.2 1.5-3.55 4.25-3.55h1.15M9.9 7.45l1.75 1.75-1.75 1.75"
      />
    </IconSvg>
  );
}

function renderFileIcon(kind: WorkspaceFileIconKind) {
  switch (kind) {
    case "folder-closed":
      return <FolderClosedIcon />;
    case "folder-open":
      return <FolderOpenIcon />;
    case "text":
      return <TextFileIcon />;
    case "image":
      return <ImageFileIcon />;
    case "audio":
      return <AudioFileIcon />;
    case "video":
      return <VideoFileIcon />;
    case "archive":
      return <ArchiveFileIcon />;
    case "binary":
      return <BinaryFileIcon />;
    case "config":
      return <ConfigFileIcon />;
    case "symlink":
      return <SymlinkIcon />;
    case "file":
    default:
      return <GenericFileIcon />;
  }
}

export function FileTypeIcon({
  kind,
  className,
  title,
}: FileTypeIconProps) {
  const classes = [
    "workspace-file-icon",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      data-kind={kind}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      title={title}
    >
      {renderFileIcon(kind)}
    </span>
  );
}
