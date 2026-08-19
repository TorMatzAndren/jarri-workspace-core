export type WorkspaceProjectionItem = {
  label: string;
  value: string | number | boolean | null | undefined;
};

export type WorkspaceProjectionSection = {
  title: string;
  items: WorkspaceProjectionItem[];
};

export type WorkspaceProjectionDocument = {
  sections: WorkspaceProjectionSection[];
  rawBody?: string;
};

export type WorkspaceProjectionExporter = () => WorkspaceProjectionDocument;

export type WorkspaceProjectionPublicationLease = {
  release: () => void;
};

export type WorkspaceProjectionPublisher = {
  publish: (
    exporter: WorkspaceProjectionExporter,
  ) => WorkspaceProjectionPublicationLease;
};

export type WorkspaceProjectionPublicationController =
  WorkspaceProjectionPublisher & {
    getSnapshot: () => WorkspaceProjectionExporter;
    reset: (initialExporter?: WorkspaceProjectionExporter) => void;
    setInitial: (initialExporter: WorkspaceProjectionExporter) => void;
    subscribe: (listener: () => void) => () => void;
  };

export type PanelSemanticPublicationLease = WorkspaceProjectionPublicationLease;
export type PanelSemanticPublisher = WorkspaceProjectionPublisher;
export type PanelSemanticPublicationController =
  WorkspaceProjectionPublicationController;

export type WorkspaceProjectionFormatContext = {
  panelTitle: string;
  moduleTitle?: string;
  moduleId: string;
  panelType: string;
  copiedAt: string;
  projection: WorkspaceProjectionDocument;
};

export function createStatusProjection(
  status: string,
  detail: string,
): WorkspaceProjectionDocument {
  return {
    sections: [
      {
        title: "State",
        items: [
          { label: "Status", value: status },
          { label: "Content", value: detail },
        ],
      },
    ],
  };
}

export function createUnavailableProjection(
  reason: string,
  recovery: string,
): WorkspaceProjectionDocument {
  return {
    sections: [
      {
        title: "State",
        items: [
          { label: "Status", value: "Unavailable" },
          { label: "Reason", value: reason },
          { label: "Recovery", value: recovery },
        ],
      },
    ],
  };
}

export function createErrorProjection(reason: string): WorkspaceProjectionDocument {
  return {
    sections: [
      {
        title: "State",
        items: [
          { label: "Status", value: "Error" },
          { label: "Reason", value: reason },
        ],
      },
    ],
  };
}

export function formatWorkspaceProjection({
  panelTitle,
  moduleTitle,
  moduleId,
  panelType,
  copiedAt,
  projection,
}: WorkspaceProjectionFormatContext): string {
  const lines = [
    "Workspace Projection",
    `Panel: ${moduleTitle || moduleId} / ${panelTitle}`,
    `Path: ${moduleId} / ${panelType}`,
    `Copied: ${copiedAt}`,
  ];

  if (projection.rawBody !== undefined) {
    return `${lines.join("\n")}\n\n${projection.rawBody}`;
  }

  for (const section of projection.sections) {
    lines.push("");
    lines.push(section.title);
    for (const item of section.items) {
      lines.push(`${item.label}: ${formatProjectionValue(item.value)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function createWorkspaceProjectionPublicationController():
  WorkspaceProjectionPublicationController {
  let generation = 0;
  let nextPublicationId = 1;
  let initialExporter: WorkspaceProjectionExporter = () =>
    createStatusProjection("Loading", "Waiting for panel content");
  let current:
    | {
        generation: number;
        publicationId: number;
        exporter: WorkspaceProjectionExporter;
        document: WorkspaceProjectionDocument;
      }
    | null = null;
  const listeners = new Set<() => void>();
  let emitQueued = false;

  function emit() {
    if (emitQueued) {
      return;
    }
    emitQueued = true;
    queueMicrotask(() => {
      emitQueued = false;
      for (const listener of listeners) {
        listener();
      }
    });
  }

  return {
    publish(exporter) {
      const document = exporter();
      if (
        current &&
        sameWorkspaceProjectionDocument(current.document, document)
      ) {
        return {
          release() {
            return undefined;
          },
        };
      }

      const publication = {
        generation,
        publicationId: nextPublicationId++,
        exporter,
        document,
      };
      current = publication;
      emit();

      let released = false;
      return {
        release() {
          if (released) {
            return;
          }
          released = true;
          if (
            current?.generation !== publication.generation ||
            current.publicationId !== publication.publicationId
          ) {
            return;
          }
          current = null;
          emit();
        },
      };
    },
    getSnapshot() {
      return current?.exporter ?? initialExporter;
    },
    reset(nextInitialExporter) {
      generation += 1;
      nextPublicationId = 1;
      if (nextInitialExporter) {
        initialExporter = nextInitialExporter;
      }
      if (!current) {
        emit();
        return;
      }
      current = null;
      emit();
    },
    setInitial(nextInitialExporter) {
      initialExporter = nextInitialExporter;
      if (!current) {
        emit();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function formatProjectionValue(
  value: WorkspaceProjectionItem["value"],
): string {
  if (value === null || value === undefined) {
    return "none";
  }
  return String(value);
}

function sameWorkspaceProjectionDocument(
  left: WorkspaceProjectionDocument,
  right: WorkspaceProjectionDocument,
): boolean {
  if (
    !hasOnlyProjectionDocumentKeys(left) ||
    !hasOnlyProjectionDocumentKeys(right)
  ) {
    return left === right;
  }

  return (
    left.rawBody === right.rawBody &&
    sameProjectionSections(left.sections, right.sections)
  );
}

function hasOnlyProjectionDocumentKeys(
  document: WorkspaceProjectionDocument,
): boolean {
  return Object.keys(document).every(
    (key) => key === "sections" || key === "rawBody",
  );
}

function sameProjectionSections(
  left: readonly WorkspaceProjectionSection[],
  right: readonly WorkspaceProjectionSection[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((section, index) => {
    const candidate = right[index];
    return (
      candidate !== undefined &&
      section.title === candidate.title &&
      sameProjectionItems(section.items, candidate.items)
    );
  });
}

function sameProjectionItems(
  left: readonly WorkspaceProjectionItem[],
  right: readonly WorkspaceProjectionItem[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const candidate = right[index];
    return (
      candidate !== undefined &&
      item.label === candidate.label &&
      Object.is(item.value, candidate.value)
    );
  });
}
