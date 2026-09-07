import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCandidatePool,
  drawItems,
  parseMembers,
} from "../src/domain.js";

const groups = [
  { id: "g1", name: "产品组", members: ["张三", "李四"] },
  { id: "g2", name: "研发组", members: ["王五"] },
  { id: "g3", name: "空组", members: [] },
];

test("parseMembers supports common Chinese separators and removes duplicates", () => {
  assert.deepEqual(parseMembers(" 张三\n李四，王五、张三; 赵六； "), [
    "张三",
    "李四",
    "王五",
    "赵六",
  ]);
});

test("allPeople merges members and preserves group context", () => {
  assert.deepEqual(buildCandidatePool(groups, "allPeople"), [
    { id: "g1::张三", name: "张三", groupId: "g1", groupName: "产品组", type: "person" },
    { id: "g1::李四", name: "李四", groupId: "g1", groupName: "产品组", type: "person" },
    { id: "g2::王五", name: "王五", groupId: "g2", groupName: "研发组", type: "person" },
  ]);
});

test("selectedGroup only contains members from the chosen group", () => {
  assert.deepEqual(buildCandidatePool(groups, "selectedGroup", "g2").map((item) => item.name), ["王五"]);
});

test("groups mode excludes empty groups", () => {
  assert.deepEqual(buildCandidatePool(groups, "groups").map((item) => item.name), ["产品组", "研发组"]);
});

test("drawItems excludes previous winners and supports deterministic selection", () => {
  const items = buildCandidatePool(groups, "allPeople");
  const picked = drawItems(items, 2, new Set(["g1::张三"]), () => 0);
  assert.deepEqual(picked.map((item) => item.name), ["李四", "王五"]);
});

test("drawItems rejects impossible counts", () => {
  const items = buildCandidatePool(groups, "groups");
  assert.throws(() => drawItems(items, 3, new Set(), () => 0), /候选对象不足/);
  assert.throws(() => drawItems(items, 0, new Set(), () => 0), /至少抽取 1 个/);
});
