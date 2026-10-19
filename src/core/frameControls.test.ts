import {
  createFrameControlCenter,
  enabledHeaderPanelFrameControls,
  invokePanelFrameCopyControl,
  nextPanelFontScale,
  normalizeFrameControlPreferences,
  panelFrameControlKey,
  panelFrameControlViewStates,
  SCREENSHOT_CONTROL_ID,
  ORGANIZE_LOCK_CONTROL_ID,
  SEMANTIC_COPY_CONTROL_ID,
  WORKSPACE_FRAME_CONTROL_CATALOG,
} from "./frameControls";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function tick() {
  return Promise.resolve();
}

function copyPayload(text: string) {
  return {
    kind: "copy" as const,
    copyText: () => text,
  };
}

function testWorkspaceOwnsControlCatalog() {
  assertEqual(
    WORKSPACE_FRAME_CONTROL_CATALOG.length,
    5,
    "Workspace catalog contains Copy, Screenshot, Font, and Organize Lock controls",
  );

  const copy = WORKSPACE_FRAME_CONTROL_CATALOG.find(
    (candidate) => candidate.controlId === SEMANTIC_COPY_CONTROL_ID,
  );
  assert(copy, "Workspace semantic Copy control exists");
  assertEqual(copy.label, "Copy", "Workspace owns the frame-control label");

  const screenshot = WORKSPACE_FRAME_CONTROL_CATALOG.find(
    (candidate) => candidate.controlId === SCREENSHOT_CONTROL_ID,
  );
  assert(screenshot, "Workspace Screenshot control exists");
  assertEqual(
    screenshot.kind,
    "screenshot",
    "Screenshot is a Workspace-owned frame capability",
  );
  assertEqual(
    screenshot.defaultEnabled,
    true,
    "Screenshot is enabled by default",
  );
}

function testOrganizeLockVisibilityIsConfigurationOnly() {
  const lock = WORKSPACE_FRAME_CONTROL_CATALOG.find(
    (candidate) => candidate.controlId === ORGANIZE_LOCK_CONTROL_ID,
  );
  assert(lock, "Organize Lock is a standard configurable frame control");
  const key = panelFrameControlKey("demo", "file-browser", ORGANIZE_LOCK_CONTROL_ID);
  const hidden = panelFrameControlViewStates({ controls: [lock], moduleId: "demo", panelType: "file-browser",
    preferences: { visibility: { [key]: false } }, runtimeSnapshot: { payloads: new Map() } });
  assertEqual(hidden[0].enabled, false, "Frame Settings visibility hides the control");
  assertEqual(enabledHeaderPanelFrameControls(hidden).length, 0, "hidden control is not rendered in the header");
  const visible = panelFrameControlViewStates({ controls: [lock], moduleId: "demo", panelType: "file-browser",
    preferences: { visibility: { [key]: true } }, runtimeSnapshot: { payloads: new Map() } });
  assertEqual(visible[0].enabled, true, "the control can be made visible again independently");
}

function testStablePreferenceKeysAndDefaults() {
  const key = panelFrameControlKey("demo", "timeline", "semantic-copy");

  assertEqual(
    key,
    "demo:timeline:semantic-copy",
    "preference key uses module, panel type, and control id",
  );

  const states = panelFrameControlViewStates({
    controls: WORKSPACE_FRAME_CONTROL_CATALOG,
    moduleId: "demo",
    panelType: "timeline",
    preferences: { visibility: {} },
    runtimeSnapshot: { payloads: new Map() },
  });

  assertEqual(states[0].enabled, true, "Workspace default is honored");
  assertEqual(
    states[0].available,
    false,
    "Copy without runtime payload is unavailable",
  );
}

function testPreferenceNormalizationAndBackwardCompatibility() {
  assertEqual(
    Object.keys(normalizeFrameControlPreferences(undefined).visibility).length,
    0,
    "missing preferences normalize for old layouts",
  );

  const normalized = normalizeFrameControlPreferences({
    visibility: {
      "demo:timeline:semantic-copy": false,
      "bad key": true,
      "missing:parts": true,
      "demo:truth:semantic-copy": "yes",
    },
  });

  assertEqual(
    normalized.visibility["demo:timeline:semantic-copy"],
    false,
    "valid boolean preference is preserved",
  );
  assertEqual(
    Object.keys(normalized.visibility).length,
    1,
    "malformed preferences are discarded",
  );
}

function testPerPanelTypeVisibility() {
  const timelineKey = panelFrameControlKey(
    "demo",
    "timeline",
    SEMANTIC_COPY_CONTROL_ID,
  );
  const truthKey = panelFrameControlKey(
    "demo",
    "truth",
    SEMANTIC_COPY_CONTROL_ID,
  );

  const runtimeSnapshot = {
    payloads: new Map([[SEMANTIC_COPY_CONTROL_ID, copyPayload("copy text")]]),
  };

  const timelineStates = panelFrameControlViewStates({
    controls: WORKSPACE_FRAME_CONTROL_CATALOG,
    moduleId: "demo",
    panelType: "timeline",
    preferences: {
      visibility: {
        [timelineKey]: false,
        [truthKey]: true,
      },
    },
    runtimeSnapshot,
  });

  const truthStates = panelFrameControlViewStates({
    controls: WORKSPACE_FRAME_CONTROL_CATALOG,
    moduleId: "demo",
    panelType: "truth",
    preferences: {
      visibility: {
        [timelineKey]: false,
        [truthKey]: true,
      },
    },
    runtimeSnapshot,
  });

  assertEqual(timelineStates[0].enabled, false, "timeline Copy is hidden");
  assertEqual(truthStates[0].enabled, true, "truth Copy remains visible");
}

async function testRuntimePublishReleaseAndStaleLease() {
  const center = createFrameControlCenter();
  const first = copyPayload("first");
  const second = copyPayload("second");

  const firstLease = center.publish(SEMANTIC_COPY_CONTROL_ID, first);
  center.publish(SEMANTIC_COPY_CONTROL_ID, second);
  firstLease.release();

  assertEqual(
    center.getSnapshot().payloads.get(SEMANTIC_COPY_CONTROL_ID),
    second,
    "stale lease cannot remove a newer payload",
  );

  let notifications = 0;
  const unsubscribe = center.subscribe(() => {
    notifications += 1;
  });

  const lease = center.publish(SEMANTIC_COPY_CONTROL_ID, first);
  await tick();
  lease.release();
  await tick();
  unsubscribe();

  assertEqual(notifications, 2, "publish and release notify subscribers");
}

function testRuntimeIsolationAndReset() {
  const firstCenter = createFrameControlCenter();
  const secondCenter = createFrameControlCenter();
  const firstPayload = copyPayload("first instance");
  const secondPayload = copyPayload("second instance");

  firstCenter.publish(SEMANTIC_COPY_CONTROL_ID, firstPayload);
  secondCenter.publish(SEMANTIC_COPY_CONTROL_ID, secondPayload);
  firstCenter.reset();

  assertEqual(
    firstCenter.getSnapshot().payloads.has(SEMANTIC_COPY_CONTROL_ID),
    false,
    "reset clears the first panel instance",
  );
  assertEqual(
    secondCenter.getSnapshot().payloads.get(SEMANTIC_COPY_CONTROL_ID),
    secondPayload,
    "reset does not affect another panel instance",
  );
}

async function testClipboardDispatchUsesRuntimePayload() {
  const states = panelFrameControlViewStates({
    controls: WORKSPACE_FRAME_CONTROL_CATALOG,
    moduleId: "demo",
    panelType: "timeline",
    preferences: { visibility: {} },
    runtimeSnapshot: {
      payloads: new Map([
        [SEMANTIC_COPY_CONTROL_ID, copyPayload("projection text")],
      ]),
    },
  });

  let copied = "";
  await invokePanelFrameCopyControl(states[0], async (text) => {
    copied = text;
  });

  assertEqual(
    copied,
    "projection text",
    "Workspace dispatch uses the panel runtime payload",
  );
}

function testIndependentFontControlsAndDeterministicStepping() {
  assertEqual(nextPanelFontScale(1, "increase"), 1.15, "increase step");
  assertEqual(nextPanelFontScale(1, "decrease"), 0.85, "decrease step");
  assertEqual(nextPanelFontScale(2, "increase"), 2, "increase clamps high");
  assertEqual(nextPanelFontScale(0.75, "decrease"), 0.75, "decrease clamps low");

  const states = panelFrameControlViewStates({
    controls: WORKSPACE_FRAME_CONTROL_CATALOG,
    moduleId: "demo",
    panelType: "timeline",
    preferences: {
      visibility: {
        "demo:timeline:semantic-copy": false,
      },
    },
    runtimeSnapshot: {
      payloads: new Map([
        [SEMANTIC_COPY_CONTROL_ID, copyPayload("projection text")],
      ]),
    },
  });

  assertEqual(
    enabledHeaderPanelFrameControls(states).length,
    4,
    "disabling Copy does not disable Screenshot, Font, or Organize Lock controls",
  );
}

async function main() {
  testWorkspaceOwnsControlCatalog();
  testOrganizeLockVisibilityIsConfigurationOnly();
  testStablePreferenceKeysAndDefaults();
  testPreferenceNormalizationAndBackwardCompatibility();
  testPerPanelTypeVisibility();
  await testRuntimePublishReleaseAndStaleLease();
  testRuntimeIsolationAndReset();
  await testClipboardDispatchUsesRuntimePayload();
  testIndependentFontControlsAndDeterministicStepping();
  console.log("Workspace frame-control tests passed");
}

void main();
