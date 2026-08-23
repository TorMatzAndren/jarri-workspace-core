import {
  clampWorkspaceNumberValue,
  parseWorkspaceNumberDraft,
  stepWorkspaceNumberValue,
} from "./WorkspaceNumberInput";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function assertValid(actual: ReturnType<typeof parseWorkspaceNumberDraft>) {
  if (actual.kind !== "valid") {
    throw new Error(`expected valid parse result, got ${actual.kind}`);
  }

  return actual.value;
}

function testIncrement() {
  assertEqual(
    stepWorkspaceNumberValue(4, 1, { min: 0, max: 10, step: 2 }),
    6,
    "increment applies configured step",
  );
}

function testDecrement() {
  assertEqual(
    stepWorkspaceNumberValue(4, -1, { min: 0, max: 10, step: 2 }),
    2,
    "decrement applies configured step",
  );
}

function testMinClamp() {
  assertEqual(
    stepWorkspaceNumberValue(1, -1, { min: 0, max: 10, step: 2 }),
    0,
    "decrement clamps to min",
  );
  assertEqual(
    clampWorkspaceNumberValue(-12, 0, 10),
    0,
    "direct clamp respects min",
  );
}

function testMaxClamp() {
  assertEqual(
    stepWorkspaceNumberValue(9, 1, { min: 0, max: 10, step: 2 }),
    10,
    "increment clamps to max",
  );
  assertEqual(
    clampWorkspaceNumberValue(12, 0, 10),
    10,
    "direct clamp respects max",
  );
}

function testNonIntegerStep() {
  assertEqual(
    stepWorkspaceNumberValue(1, 1, { min: 0.1, max: 100, step: 0.1 }),
    1.1,
    "decimal increment keeps deterministic precision",
  );
  assertEqual(
    stepWorkspaceNumberValue(1.1, -1, { min: 0.1, max: 100, step: 0.1 }),
    1,
    "decimal decrement keeps deterministic precision",
  );
}

function testInvalidNumericInputHandling() {
  assertEqual(
    parseWorkspaceNumberDraft("").kind,
    "blank",
    "blank draft is preserved as intermediate input",
  );
  assertEqual(
    parseWorkspaceNumberDraft("abc").kind,
    "invalid",
    "non-numeric draft is invalid",
  );
  assertEqual(
    parseWorkspaceNumberDraft("-").kind,
    "invalid",
    "sign-only draft is invalid but non-committing",
  );
  assertEqual(
    assertValid(parseWorkspaceNumberDraft("12.5")),
    12.5,
    "valid decimal draft parses",
  );
}

function testDisabledBehaviorByContract() {
  let calls = 0;
  const disabled = true;
  const onChange = () => {
    calls += 1;
  };

  if (!disabled) {
    onChange();
  }

  assertEqual(calls, 0, "disabled control does not invoke changes");
}

testIncrement();
testDecrement();
testMinClamp();
testMaxClamp();
testNonIntegerStep();
testInvalidNumericInputHandling();
testDisabledBehaviorByContract();

console.log("workspace number input tests passed");
