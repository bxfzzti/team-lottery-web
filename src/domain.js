const MEMBER_SEPARATOR = /[\n\r,，、;；]+/u;

export function parseMembers(text = "") {
  const seen = new Set();
  return String(text)
    .split(MEMBER_SEPARATOR)
    .map((name) => name.trim())
    .filter((name) => {
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

export function parseRosterTable(text = "") {
  const groups = new Map();
  String(text).split(/[\n\r]+/u).forEach((line) => {
    const columns = line.split(/\t|,|，/u).map((value) => value.trim());
    const groupName = columns[0];
    const memberName = columns.slice(1).join(" ").trim();
    if (!groupName || !memberName) return;
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(memberName);
  });
  return [...groups.entries()].map(([name, members]) => ({
    name,
    membersText: parseMembers(members.join("\n")).join("\n"),
  }));
}

export function validateDrawCount(value, availableCount) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    return { valid: false, count: null, message: "抽取数量必须是大于 0 的整数" };
  }
  if (count > availableCount) {
    return { valid: false, count, message: `候选对象不足：最多可抽 ${availableCount} 个` };
  }
  return { valid: true, count, message: "" };
}

function membersFor(group) {
  return Array.isArray(group.members)
    ? parseMembers(group.members.join("\n"))
    : parseMembers(group.membersText);
}

export function buildCandidatePool(groups = [], mode, selectedGroupId = "") {
  const normalizedGroups = groups.map((group) => ({
    ...group,
    name: String(group.name ?? "").trim() || "未命名小组",
    members: membersFor(group),
  }));

  if (mode === "groups") {
    return normalizedGroups
      .filter((group) => group.members.length > 0)
      .map((group) => ({
        id: group.id,
        name: group.name,
        groupId: group.id,
        groupName: group.name,
        type: "group",
      }));
  }

  const sourceGroups = mode === "selectedGroup"
    ? normalizedGroups.filter((group) => group.id === selectedGroupId)
    : normalizedGroups;

  return sourceGroups.flatMap((group) =>
    group.members.map((name) => ({
      id: `${group.id}::${name}`,
      name,
      groupId: group.id,
      groupName: group.name,
      type: "person",
    })),
  );
}

export function secureRandomIndex(max) {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new RangeError("随机范围必须是有效的正整数");
  }

  const range = 2 ** 32;
  const limit = Math.floor(range / max) * max;
  const values = new Uint32Array(1);
  let value;

  do {
    globalThis.crypto.getRandomValues(values);
    value = values[0];
  } while (value >= limit);

  return value % max;
}

export function drawItems(items, count, excludedIds = new Set(), randomIndex = secureRandomIndex) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("至少抽取 1 个对象");
  }

  const available = items.filter((item) => !excludedIds.has(item.id));
  if (count > available.length) {
    throw new RangeError(`候选对象不足：当前仅剩 ${available.length} 个`);
  }

  const winners = [];
  const pool = [...available];
  while (winners.length < count) {
    const index = randomIndex(pool.length);
    winners.push(pool.splice(index, 1)[0]);
  }
  return winners;
}
