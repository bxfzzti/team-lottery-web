export function parseMembers(text = "") {
  return [...new Set(readCells(String(text), /[\n\r,，、;；]/u).rows.flatMap(row => row.cells).map(name => name.trim()).filter(Boolean))];
}

export function memberEntryCount(text = "") {
  return readCells(String(text), /[\n\r,，、;；]/u).rows.flatMap(row => row.cells).filter(name => name.trim()).length;
}

export function encodeMembers(names) {
  return [...new Set(names)].map(name => /[\n\r,，、;；"]/u.test(name) ? `"${name.replaceAll('"', '""')}"` : name).join("\n");
}

function readCells(text, separator) {
  const rows = [];
  let cells = [], value = "", quoted = false, line = 1, start = 1;
  const pushCell = () => { cells.push(value.trim()); value = ""; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && (quoted || !value.trim())) {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === '\n' || c === '\r')) {
      pushCell(); rows.push({ cells, line: start }); cells = [];
      if (c === '\r' && text[i + 1] === '\n') i++;
      line++; start = line;
    } else if (!quoted && separator.test(c)) pushCell();
    else { value += c; if (c === '\n') line++; }
  }
  pushCell(); rows.push({ cells, line: start });
  return { rows, unclosed: quoted };
}

export function inspectRosterTable(text = "") {
  text = String(text).replace(/^\ufeff/u, "");
  const parsed = readCells(text, /[\t,，]/u);
  const groups = new Map(), errors = [], warnings = [];
  if (parsed.unclosed) errors.push("引号未闭合，请检查名单格式");
  const groupHeaders = new Set(["小组", "小组名称", "组名", "组别", "分组", "部门", "部门名称", "团队"]);
  const memberHeaders = new Set(["姓名", "成员", "员工", "人员", "员工姓名", "成员姓名"]);
  let groupColumn = 0, memberColumn = 1, currentGroup = "", first = true;
  for (const row of parsed.rows) {
    const columns = row.cells;
    if (columns.every(value => !value)) continue;
    if (columns.length !== 2) { errors.push(`第 ${row.line} 行应为两列，实际 ${columns.length} 列`); continue; }
    if (first) {
      first = false;
      const g = columns.findIndex(value => groupHeaders.has(value));
      const m = columns.findIndex(value => memberHeaders.has(value));
      if (g >= 0 && m >= 0 && g !== m) { groupColumn = g; memberColumn = m; continue; }
    }
    if (columns[groupColumn]) currentGroup = columns[groupColumn];
    const name = columns[memberColumn];
    if (!name) { warnings.push(`第 ${row.line} 行未填写姓名，仅更新小组`); continue; }
    if (!currentGroup) { errors.push(`第 ${row.line} 行缺少小组名称`); continue; }
    if (!groups.has(currentGroup)) groups.set(currentGroup, []);
    const members = groups.get(currentGroup);
    const names = name.split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
    if (names.length > 1) warnings.push(`第 ${row.line} 行单元格换行拆为 ${names.length} 名成员`);
    for (const member of names) {
      if (members.includes(member)) warnings.push(`第 ${row.line} 行重复成员“${member}”已合并`);
      else members.push(member);
    }
  }
  return { groups: [...groups].map(([name, members]) => ({ name, membersText: encodeMembers(members) })), errors, warnings };
}

export function parseRosterTable(text = "") {
  return inspectRosterTable(text).groups;
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
    ? [...new Set(group.members.map(name => String(name).trim()).filter(Boolean))]
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
