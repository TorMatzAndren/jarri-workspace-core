import { isNewVirtualListScrollRequest } from "./virtualList";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(isNewVirtualListScrollRequest(null, 1), "an explicit selection request is applied");
assert(!isNewVirtualListScrollRequest(1, 1), "playback, AUTO, projection, and measurement updates retain user scroll");
assert(isNewVirtualListScrollRequest(1, 2), "a later selection creates a new visibility request");
assert(!isNewVirtualListScrollRequest(null, null), "remount without a pending selection preserves restored scroll");

console.log("Virtual list scroll request tests passed");
