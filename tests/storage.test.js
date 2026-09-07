import test from "node:test";
import assert from "node:assert/strict";

import { createStorage } from "../src/storage.js";

function memoryAdapter(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("storage saves and restores versioned state", () => {
  const adapter = memoryAdapter();
  const storage = createStorage(adapter, "test");
  const state = { groups: [{ id: "g1", name: "一组", membersText: "张三" }] };
  storage.save(state);
  assert.deepEqual(storage.load(), state);
});

test("storage falls back when JSON is corrupt or schema is unknown", () => {
  assert.deepEqual(createStorage(memoryAdapter({ test: "{" }), "test").load(), { groups: [] });
  assert.deepEqual(
    createStorage(memoryAdapter({ test: JSON.stringify({ version: 99, state: { groups: [1] } }) }), "test").load(),
    { groups: [] },
  );
});

test("storage clears saved data", () => {
  const adapter = memoryAdapter();
  const storage = createStorage(adapter, "test");
  storage.save({ groups: [] });
  storage.clear();
  assert.deepEqual(storage.load(), { groups: [] });
});
