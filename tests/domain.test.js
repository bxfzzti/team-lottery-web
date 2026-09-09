import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCandidatePool,
  drawItems,
  parseMembers,
  parseRosterTable,
  inspectRosterTable,
  encodeMembers,
  validateDrawCount,
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

test("parseRosterTable reads two-column spreadsheet rows and merges groups", () => {
  assert.deepEqual(parseRosterTable("产品组\t张三\n产品组\t李四\n研发组,王五\n研发组，赵六\n无效行"), [
    { name: "产品组", membersText: "张三\n李四" },
    { name: "研发组", membersText: "王五\n赵六" },
  ]);
});

test("parseRosterTable handles headers, merged Excel group cells, BOM, and quoted CSV", () => {
  const pasted = "\ufeff小组\t姓名\n产品组\t张三\n\t李四\n\"研发组\",\"王五\"\n\"研发组\",\"赵六\"";
  assert.deepEqual(parseRosterTable(pasted), [
    { name: "产品组", membersText: "张三\n李四" },
    { name: "研发组", membersText: "王五\n赵六" },
  ]);
});

test("validateDrawCount rejects decimals and out-of-range values without changing them", () => {
  assert.deepEqual(validateDrawCount("2", 3), { valid: true, count: 2, message: "" });
  assert.equal(validateDrawCount("1.5", 3).valid, false);
  assert.equal(validateDrawCount("4", 3).message, "候选对象不足：最多可抽 3 个");
});

test('blank name updates group for following merged cells', () => {
  assert.deepEqual(parseRosterTable('A组\t甲\nB组\t\n\t乙'), [{name:'A组',membersText:'甲'}, {name:'B组',membersText:'乙'}]);
});
test('reversed and expanded headers map correctly', () => {
  assert.deepEqual(parseRosterTable('员工姓名\t小组名称\n张三\t产品组'), [{name:'产品组',membersText:'张三'}]);
});
test('extra columns and malformed quotes produce actionable errors', () => {
  assert.match(inspectRosterTable('A组\t甲\t乙').errors[0], /第 1 行/);
  assert.match(inspectRosterTable('A组,"甲').errors[0], /引号未闭合/);
});
test('quoted multiline cells preserve all members', () => {
  assert.deepEqual(parseRosterTable('"A组","甲\n乙"'), [{name:'A组',membersText:'甲\n乙'}]);
});
test('comma names survive import, editor serialization and candidate creation', () => {
  const groups = parseRosterTable('"A组","Smith, John"');
  const names = parseMembers(groups[0].membersText);
  assert.deepEqual(names, ['Smith, John']);
  assert.deepEqual(parseMembers(encodeMembers(names)), names);
  assert.equal(buildCandidatePool([{id:'a',...groups[0]}], 'allPeople').length, 1);
});
