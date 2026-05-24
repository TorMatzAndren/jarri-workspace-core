import { Fragment } from "react";
import { WorkspaceFileLink } from "./WorkspaceFileLink";
import type { OpenResourceRequest, OpenResourceResult } from "./resources";

type Props = {
  text: string;
  openResource: (request: OpenResourceRequest) => OpenResourceResult;
};

/*
  Only match real-looking filesystem paths.
  Good:
    /home/user/project/src/main.ts
    /var/log/example/service.log
    /etc/example/config.conf

  Bad:
    /inspector
    /editor
*/
const FILE_PATH_RE = /\/(?:[A-Za-z0-9._-]+\/)+(?:[A-Za-z0-9._-]+)?/g;

function splitTrailingPunctuation(raw: string) {
  const match = raw.match(/^(.+?)([)\],.:;!?]+)?$/);

  if (!match) {
    return { path: raw, trailing: "" };
  }

  return {
    path: match[1],
    trailing: match[2] ?? "",
  };
}

function looksLikeRealPath(path: string) {
  if (!path.startsWith("/")) {
    return false;
  }

  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return false;
  }

  const parts = trimmed.split("/").filter(Boolean);
  return parts.length >= 2;
}

function getHeadingInfo(line: string) {
  const trimmed = line.trim();

  const h2 = trimmed.match(/^##\s+(.+)$/);
  if (h2) {
    return { level: 2 as const, text: h2[1].trim() };
  }

  const h1 = trimmed.match(/^#\s+(.+)$/);
  if (h1) {
    return { level: 1 as const, text: h1[1].trim() };
  }

  return null;
}

function renderLine(
  line: string,
  lineIndex: number,
  openResource: (request: OpenResourceRequest) => OpenResourceResult,
) {
  const heading = getHeadingInfo(line);
  const content = heading ? heading.text : line;
  const matches = Array.from(content.matchAll(FILE_PATH_RE));
  const nodes: React.ReactNode[] = [];

  if (matches.length === 0) {
    const className = heading
      ? `workspace-text-links__line workspace-text-links__line--heading workspace-text-links__line--h${heading.level}`
      : "workspace-text-links__line";

    return (
      <div
        key={`line-${lineIndex}`}
        className={className}
        data-heading-line={heading ? String(lineIndex) : undefined}
      >
        {content || "\u00A0"}
      </div>
    );
  }

  let cursor = 0;

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const rawCandidate = match[0];
    const start = match.index ?? 0;
    const end = start + rawCandidate.length;

    if (start > cursor) {
      nodes.push(
        <Fragment key={`text-${lineIndex}-${index}-${cursor}`}>
          {content.slice(cursor, start)}
        </Fragment>,
      );
    }

    const { path, trailing } = splitTrailingPunctuation(rawCandidate);

    if (looksLikeRealPath(path)) {
      nodes.push(
        <WorkspaceFileLink
          key={`path-${lineIndex}-${index}-${start}`}
          path={path}
          openResource={openResource}
        />,
      );
    } else {
      nodes.push(
        <Fragment key={`plain-${lineIndex}-${index}-${start}`}>
          {path}
        </Fragment>,
      );
    }

    if (trailing) {
      nodes.push(
        <Fragment key={`trail-${lineIndex}-${index}-${start}`}>
          {trailing}
        </Fragment>,
      );
    }

    cursor = end;
  }

  if (cursor < content.length) {
    nodes.push(
      <Fragment key={`tail-${lineIndex}-${cursor}`}>
        {content.slice(cursor)}
      </Fragment>,
    );
  }

  const className = heading
    ? `workspace-text-links__line workspace-text-links__line--heading workspace-text-links__line--h${heading.level}`
    : "workspace-text-links__line";

  return (
    <div
      key={`line-${lineIndex}`}
      className={className}
      data-heading-line={heading ? String(lineIndex) : undefined}
    >
      {nodes.length > 0 ? nodes : "\u00A0"}
    </div>
  );
}

export function WorkspaceTextLinks({ text, openResource }: Props) {
  const lines = text.split(/\r?\n/);

  return (
    <div className="workspace-text-links">
      {lines.map((line, index) => renderLine(line, index, openResource))}
    </div>
  );
}
