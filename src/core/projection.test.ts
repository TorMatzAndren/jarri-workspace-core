import { formatWorkspaceProjection } from "./projection";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function testFormatterEnvelopeAndSections() {
  const formatted = formatWorkspaceProjection({
    panelTitle: "Timeline Demo",
    moduleTitle: "Demo Panels",
    moduleId: "demo",
    panelType: "timeline",
    copiedAt: "2026-08-19T12:34:56.000Z",
    projection: {
      sections: [
        {
          title: "Replay Cursor",
          items: [
            { label: "Query", value: null },
            { label: "Importance", value: undefined },
            { label: "Returned", value: 6 },
            { label: "Live", value: true },
          ],
        },
      ],
    },
  });

  assertEqual(
    formatted,
    [
      "Workspace Projection",
      "Panel: Demo Panels / Timeline Demo",
      "Path: demo / timeline",
      "Copied: 2026-08-19T12:34:56.000Z",
      "",
      "Replay Cursor",
      "Query: none",
      "Importance: none",
      "Returned: 6",
      "Live: true",
      "",
    ].join("\n"),
    "formatter output is deterministic",
  );
}

function testRawBodyFollowsEnvelopeExactly() {
  const rawBody = "Title: Example\n\nFirst line.\nSecond line.\n\n";

  const formatted = formatWorkspaceProjection({
    panelTitle: "Text",
    moduleTitle: "Demo Panels",
    moduleId: "demo",
    panelType: "text",
    copiedAt: "2026-08-19T12:34:56.000Z",
    projection: {
      sections: [
        {
          title: "Metadata",
          items: [{ label: "Dirty", value: true }],
        },
      ],
      rawBody,
    },
  });

  assertEqual(
    formatted,
    [
      "Workspace Projection",
      "Panel: Demo Panels / Text",
      "Path: demo / text",
      "Copied: 2026-08-19T12:34:56.000Z",
      "",
      rawBody,
    ].join("\n"),
    "raw body follows the common envelope",
  );
  assertEqual(
    formatted.includes("Metadata"),
    false,
    "metadata sections do not contaminate raw copied body",
  );
}

function main() {
  testFormatterEnvelopeAndSections();
  testRawBodyFollowsEnvelopeExactly();
  console.log("workspace projection tests passed");
}

main();
