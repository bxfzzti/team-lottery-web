import {
  buildCandidatePool, drawItems, parseMembers, memberEntryCount, inspectRosterTable, encodeMembers, secureRandomIndex, validateDrawCount,
} from "./domain.js?v=3";
import { createStorage } from "./storage.js?v=2";

const storage = createStorage({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) });
const elements = {
  workbench: document.querySelector(".workbench"),
  groupList: document.querySelector("#group-list"), rosterCount: document.querySelector("#roster-count"),
  addGroup: document.querySelector("#add-group"), openClear: document.querySelector("#open-clear"),
  clearDialog: document.querySelector("#clear-dialog"), confirmClear: document.querySelector("#confirm-clear"),
  openImport: document.querySelector("#open-import"), importDialog: document.querySelector("#import-dialog"),
  importText: document.querySelector("#import-text"), importError: document.querySelector("#import-error"),
  confirmImport: document.querySelector("#confirm-import"), exportRoster: document.querySelector("#export-roster"),
  groupSelectField: document.querySelector("#group-select-field"), groupSelect: document.querySelector("#group-select"),
  orderTargetField: document.querySelector("#order-target-field"), orderTarget: document.querySelector("#order-target"),
  countField: document.querySelector("#count-field"), count: document.querySelector("#draw-count"),
  repeat: document.querySelector("#allow-repeat"), repeatRow: document.querySelector("#allow-repeat").closest(".switch-row"),
  availability: document.querySelector("#availability"), drawButton: document.querySelector("#draw-button"),
  resetRound: document.querySelector("#reset-round"), resultStage: document.querySelector("#result-stage"),
  resultLabel: document.querySelector("#result-label"), resultContent: document.querySelector("#result-content"),
  resultSubtitle: document.querySelector("#result-subtitle"), copyResult: document.querySelector("#copy-result"),
  presentationMode: document.querySelector("#presentation-mode"), historyList: document.querySelector("#history-list"),
  historyCount: document.querySelector("#history-count"),
};

let idSequence = 0;
let state = storage.load();
if (state.groups.length === 0) state.groups = [makeGroup(), makeGroup()];
const round = {
  excludedPeople: new Set(state.round.excludedPeople),
  excludedGroups: new Set(state.round.excludedGroups),
  history: state.round.history,
  busy: false,
};
let notice = "";
let importPreview = null;
const previewButton = document.querySelector('#preview-import');
const previewRegion = document.querySelector('#import-preview');
const presentationDraw = document.querySelector('#presentation-draw');
let saveFailed = false;
let latestResultText = round.history[0]?.result?.replaceAll("；", "\n") ?? "";

function makeGroup(name = "", membersText = "") {
  idSequence += 1;
  return { id: globalThis.crypto.randomUUID?.() ?? `group-${Date.now()}-${idSequence}`, name, membersText };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function currentMode() { return document.querySelector('input[name="mode"]:checked').value; }
function selectedGroupId() { return elements.groupSelect.value || state.groups[0]?.id || ""; }
function modeName(mode) {
  return { allPeople: "全员抽人", selectedGroup: "指定组抽人", groups: "抽小组", groupThenPerson: "先抽组，再抽人", fullOrder: "完整顺序" }[mode];
}

function serializeState() {
  return {
    groups: state.groups,
    inactivePeople: state.inactivePeople,
    settings: {
      mode: currentMode(), selectedGroupId: selectedGroupId(), count: Number(elements.count.value) || 1,
      allowRepeat: elements.repeat.checked, orderTarget: elements.orderTarget.value,
    },
    round: { excludedPeople: [...round.excludedPeople], excludedGroups: [...round.excludedGroups], history: round.history },
  };
}

function persist() {
  const saved = storage.save(serializeState());
  saveFailed = !saved;
  if (!saved) {
    elements.availability.textContent = "浏览器无法保存名单，请不要刷新页面";
    elements.availability.classList.add("is-error", "save-error");
  }
  return saved;
}

function memberId(groupId, name) { return `${groupId}::${name}`; }
function memberCount(group) { return parseMembers(group.membersText).length; }
function activeMemberCount(group) {
  if (!group) return 0;
  return parseMembers(group.membersText).filter((name) => !state.inactivePeople.includes(memberId(group.id, name))).length;
}
function rawMemberCount(group) {
  return memberEntryCount(group.membersText);
}

function memberToggleMarkup(group) {
  const members = parseMembers(group.membersText);
  if (members.length === 0) return "";
  return `<div class="member-toggle-list" aria-label="临时参与设置">${members.map((name) => {
    const inactive = state.inactivePeople.includes(memberId(group.id, name));
    return `<button class="member-toggle${inactive ? " is-inactive" : ""}" type="button" data-member="${escapeHtml(name)}" aria-pressed="${inactive}">${escapeHtml(name)}</button>`;
  }).join("")}</div>`;
}

function renderGroupList() {
  elements.groupList.innerHTML = state.groups.map((group, index) => {
    const members = memberCount(group);
    const inactive = members - activeMemberCount(group);
    const duplicates = rawMemberCount(group) - members;
    return `<article class="group-card" data-id="${escapeHtml(group.id)}" data-index="${String(index + 1).padStart(2, "0")}">
      <div class="group-card-head"><input class="group-name" data-field="name" aria-label="第 ${index + 1} 个小组名称" value="${escapeHtml(group.name)}" placeholder="例如：产品组" maxlength="30" /><button class="icon-button remove-group" type="button" aria-label="删除小组">×</button></div>
      <textarea data-field="membersText" aria-label="${escapeHtml(group.name || "小组")}成员名单" placeholder="每行一个姓名；也可以用逗号、顿号分隔">${escapeHtml(group.membersText)}</textarea>
      <div class="group-meta"><span class="member-count">${members} 名成员${inactive ? ` · ${inactive} 人暂停` : ""}</span><span class="duplicate-note">${duplicates ? `已合并 ${duplicates} 个重复姓名` : "点击姓名可暂停参与"}</span></div>${memberToggleMarkup(group)}
    </article>`;
  }).join("");
}

function updateCardMeta(card, group) {
  const members = memberCount(group);
  const inactive = members - activeMemberCount(group);
  const duplicates = rawMemberCount(group) - members;
  card.querySelector(".member-count").textContent = `${members} 名成员${inactive ? ` · ${inactive} 人暂停` : ""}`;
  card.querySelector(".duplicate-note").textContent = duplicates ? `已合并 ${duplicates} 个重复姓名` : "输入完成后可暂停成员";
  const previous = card.querySelector('.member-toggle-list');
  if (previous) previous.remove();
  card.insertAdjacentHTML('beforeend', memberToggleMarkup(group));
}

function renderRosterCount() {
  const people = state.groups.reduce((total, group) => total + activeMemberCount(group), 0);
  const nonEmptyGroups = state.groups.filter((group) => activeMemberCount(group) > 0).length;
  const validIds = new Set(buildCandidatePool(state.groups, "allPeople").map((person) => person.id));
  const inactive = state.inactivePeople.filter((id) => validIds.has(id)).length;
  elements.rosterCount.textContent = `${people} 人 / ${nonEmptyGroups} 组${inactive ? ` · ${inactive} 暂停` : ""}`;
}

function personPool(mode = "allPeople", groupId = "") {
  return buildCandidatePool(state.groups, mode, groupId).filter((person) => !state.inactivePeople.includes(person.id));
}
function groupPool() {
  return buildCandidatePool(state.groups, "groups").filter((candidate) => activeMemberCount(state.groups.find((group) => group.id === candidate.id)) > 0);
}

function currentPools() {
  const mode = currentMode();
  const allowRepeat = elements.repeat.checked;
  if (mode === "groupThenPerson") {
    const pool = groupPool().filter((group) => personPool("selectedGroup", group.id).some((person) => allowRepeat || !round.excludedPeople.has(person.id)));
    return { pool, excluded: new Set(), mode };
  }
  if (mode === "fullOrder") {
    return { pool: elements.orderTarget.value === "groups" ? groupPool() : personPool(), excluded: new Set(), mode };
  }
  const pool = mode === "groups" ? groupPool() : personPool(mode === "selectedGroup" ? "selectedGroup" : "allPeople", selectedGroupId());
  const excluded = allowRepeat ? new Set() : mode === "groups" ? round.excludedGroups : round.excludedPeople;
  return { pool, excluded, mode };
}

function availableCandidates() {
  const { pool, excluded } = currentPools();
  return pool.filter((candidate) => !excluded.has(candidate.id));
}

function refreshControls() {
  const previous = elements.groupSelect.value || state.settings.selectedGroupId;
  elements.groupSelect.innerHTML = state.groups.map((group, index) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name.trim() || `未命名小组 ${index + 1}`)} · ${activeMemberCount(group)} 人</option>`).join("");
  if (state.groups.some((group) => group.id === previous)) elements.groupSelect.value = previous;
  const mode = currentMode();
  elements.groupSelectField.classList.toggle("is-hidden", mode !== "selectedGroup");
  elements.orderTargetField.classList.toggle("is-hidden", mode !== "fullOrder");
  elements.countField.classList.toggle("is-hidden", ["groupThenPerson", "fullOrder"].includes(mode));
  elements.repeatRow.classList.toggle("is-hidden", mode === "fullOrder");
  const available = availableCandidates();
  elements.count.max = String(Math.max(available.length, 1));
  const validation = validateDrawCount(elements.count.value, available.length);
  let message;
  if (notice) message = notice;
  else if (mode === "groupThenPerson" && available.length) message = `每个小组机会相同；当前 ${available.length} 个小组有成员可抽`;
  else if (mode === "fullOrder" && available.length) message = `独立排序：为全部 ${available.length} 个有效对象排序，不改变本轮已抽记录`;
  else if (available.length) message = `当前有 ${available.length} 个有效候选${elements.repeat.checked ? "；已开启重复抽取" : "；本轮不重复"}`;
  else message = personPool().length ? "当前范围已抽完或没有可抽对象；可重置本轮或切换范围" : "请录入成员或恢复暂停成员后再抽签";
  const countInvalid = available.length > 0 && !["groupThenPerson", "fullOrder"].includes(mode) && !validation.valid;
  if (countInvalid) message = validation.message;
  elements.availability.textContent = message;
  elements.availability.classList.toggle("is-error", available.length === 0 || countInvalid);
  elements.availability.classList.toggle("round-notice", Boolean(notice));
  elements.drawButton.disabled = round.busy || available.length === 0 || countInvalid;
  presentationDraw.disabled = elements.drawButton.disabled;
  presentationDraw.textContent = mode === 'fullOrder' ? '重新排序' : '继续抽签';
  if (saveFailed) elements.availability.textContent = '保存失败：请导出名单备份，刷新会丢失未保存进度';
  elements.drawButton.innerHTML = mode === "fullOrder" ? '<span class="spark">✦</span> 生成完整顺序 <span class="arrow">→</span>' : '<span class="spark">✦</span> 开始抽签 <span class="arrow">→</span>';
}

function renderHistory() {
  elements.historyCount.textContent = `${round.history.length} 次`;
  if (round.history.length === 0) {
    elements.historyList.innerHTML = '<li class="history-empty">还没有抽签记录</li>';
    return;
  }
  elements.historyList.innerHTML = round.history.map((entry) => `<li class="history-item"><span class="history-mode">${escapeHtml(entry.mode)}</span><span class="history-result">${escapeHtml(entry.result)}</span><time class="history-time">${escapeHtml(entry.time)}</time></li>`).join("");
}

function showPlaceholder(message = "名单准备好后<br />点击开始抽签") {
  elements.resultStage.classList.remove("is-revealed", "is-drawing");
  elements.resultLabel.textContent = "等待开始";
  elements.resultContent.innerHTML = `<span class="result-placeholder">${message}</span>`;
  elements.resultSubtitle.textContent = "结果将在这里公开展示";
}
function restoreLatestResult() {
  const latest = round.history[0];
  if (!latest) return showPlaceholder();
  elements.resultStage.classList.add("is-revealed");
  elements.resultLabel.textContent = "最近一次结果";
  if (Array.isArray(latest.results)) {
    elements.resultContent.innerHTML = resultMarkup(latest.results, latest);
  } else if (latest.mode === "完整顺序") {
    const items = latest.result.split("；");
    elements.resultContent.innerHTML = `<div class="order-list">${items.map((item, index) => `<div class="order-item"><b>${index + 1}</b><span>${escapeHtml(item.replace(/^\d+\.\s*/u, ""))}</span></div>`).join("")}</div>`;
  } else {
    elements.resultContent.innerHTML = `<span>${escapeHtml(latest.result)}</span>`;
  }
  elements.resultSubtitle.textContent = "刷新后已恢复本轮结果";
}
function clearRoundData() {
  round.excludedPeople.clear(); round.excludedGroups.clear(); round.history = []; latestResultText = "";
}
function resetRound(message = "本轮已重置，所有对象重新参与") {
  clearRoundData(); notice = message; renderHistory();
  showPlaceholder("本轮已重置<br />所有对象重新参与"); persist(); refreshControls();
}
function rosterChanged(card, group) {
  if (round.history.length) notice = "名单已更新，本轮历史和已抽记录保留；新成员可参与";
  const validIds = new Set(buildCandidatePool(state.groups, "allPeople").map((person) => person.id));
  state.inactivePeople = state.inactivePeople.filter((id) => validIds.has(id));
  if (card && group) updateCardMeta(card, group);
  renderRosterCount(); refreshControls(); persist();
}

function resultMarkup(results, { isTwoStep = false, isOrder = false } = {}) {
  if (isOrder) {
    return `<div class="order-list">${results.map((winner, index) => `<div class="order-item"><b>${index + 1}</b><span>${escapeHtml(winner.name)}${winner.type === "person" ? `<small>${escapeHtml(winner.groupName)}</small>` : ""}</span></div>`).join("")}</div>`;
  }
  return `<div class="winner-list">${results.map((winner) => `<span class="winner">${escapeHtml(winner.name)}<small>${isTwoStep && winner.type === "group" ? "第一步抽中小组" : winner.type === "group" ? "抽中小组" : escapeHtml(winner.groupName)}</small></span>`).join("")}</div>`;
}
function resultText(results, isTwoStep, isOrder) {
  if (isOrder) return results.map((item, index) => `${index + 1}. ${item.name}${item.type === "person" ? `（${item.groupName}）` : ""}`).join("\n");
  if (isTwoStep) return `${results[0].name} → ${results[1].name}`;
  return results.map((item) => item.type === 'person' ? `${item.name}（${item.groupName}）` : item.name).join("、");
}
function setBusy(busy) {
  round.busy = busy;
  elements.workbench.querySelectorAll("button, input, textarea, select").forEach((control) => { control.disabled = busy; });
  elements.workbench.classList.toggle("is-busy", busy);
}

function completeDraw(payload) {
  const { mode, results, isTwoStep, isOrder, allowRepeat } = payload;
  elements.resultStage.classList.remove("is-drawing"); elements.resultStage.classList.add("is-revealed");
  elements.resultLabel.textContent = isOrder ? "随机顺序" : isTwoStep ? "抽签结果 / 小组 → 成员" : "抽签结果";
  elements.resultContent.innerHTML = resultMarkup(results, { isTwoStep, isOrder });
  elements.resultSubtitle.textContent = isOrder ? `已生成 ${results.length} 个对象的完整顺序` : allowRepeat ? "本次为允许重复抽取" : "已抽中对象将在本轮中自动避开";
  if (!isOrder) {
    results.forEach((result) => {
      if (result.type === "group" && !isTwoStep) round.excludedGroups.add(result.id);
      if (result.type === "person") round.excludedPeople.add(result.id);
    });
  }
  latestResultText = resultText(results, isTwoStep, isOrder);
  round.history.unshift({ mode: modeName(mode), results, isTwoStep, isOrder, allowRepeat, result: latestResultText.replaceAll("\n", "；"), time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()) });
  notice = ""; renderHistory(); setBusy(false); persist(); refreshControls();
}

function animateAndReveal(payload, previewPool) {
  setBusy(true); elements.resultStage.classList.remove("is-revealed"); elements.resultStage.classList.add("is-drawing");
  elements.resultLabel.textContent = "正在抽取，请看屏幕"; elements.resultSubtitle.textContent = "结果已先计算，动画不改变随机结果";
  let cursor = 0;
  const preview = () => { const candidate = previewPool[cursor % previewPool.length]; cursor += 1; elements.resultContent.innerHTML = `<span>${escapeHtml(candidate.name)}</span>`; };
  preview();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return completeDraw(payload);
  const interval = window.setInterval(preview, 75);
  window.setTimeout(() => {
    window.clearInterval(interval);
    if (payload.isTwoStep) {
      elements.resultLabel.textContent = '第一步：已抽中小组';
      elements.resultContent.innerHTML = resultMarkup([payload.results[0]], { isTwoStep: true });
      elements.resultSubtitle.textContent = '即将揭晓组内成员';
      window.setTimeout(() => completeDraw(payload), 1000);
    } else completeDraw(payload);
  }, 1100);
}

function startDraw() {
  if (round.busy) return;
  const { pool, excluded, mode } = currentPools();
  const allowRepeat = elements.repeat.checked;
  try {
    let results;
    let isTwoStep = false;
    const isOrder = mode === "fullOrder";
    if (mode === "groupThenPerson") {
      const group = drawItems(pool, 1, new Set(), secureRandomIndex)[0];
      const person = drawItems(personPool("selectedGroup", group.id), 1, allowRepeat ? new Set() : round.excludedPeople, secureRandomIndex)[0];
      results = [group, person]; isTwoStep = true;
    } else {
      const availableCount = pool.filter((item) => !excluded.has(item.id)).length;
      const validation = validateDrawCount(isOrder ? pool.length : elements.count.value, availableCount);
      if (!validation.valid) throw new RangeError(validation.message);
      results = drawItems(pool, validation.count, excluded, secureRandomIndex);
    }
    animateAndReveal({ mode, results, isTwoStep, isOrder, allowRepeat }, pool);
  } catch (error) {
    elements.availability.textContent = error.message; elements.availability.classList.add("is-error");
  }
}

function mergeImportedGroups(imported) {
  imported.forEach((incoming) => {
    let group = state.groups.find((item) => item.name.trim() === incoming.name);
    if (!group) {
      const blank = state.groups.find((item) => !item.name.trim() && memberCount(item) === 0);
      group = blank ?? makeGroup(); if (!blank) state.groups.push(group); group.name = incoming.name;
    }
    group.membersText = encodeMembers([...parseMembers(group.membersText), ...parseMembers(incoming.membersText)]);
  });
}
function exportCsv() {
  const rows = [["小组", "姓名"]];
  state.groups.forEach((group, index) => parseMembers(group.membersText).forEach((name) => rows.push([group.name.trim() || `未命名小组 ${index + 1}`, name])));
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `团队抽签名单-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}
function copyLatestResult() {
  if (!latestResultText) { elements.resultSubtitle.textContent = "还没有可以复制的抽签结果"; return; }
  const fallback = () => { const textarea = document.createElement("textarea"); textarea.value = latestResultText; document.body.append(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); };
  (navigator.clipboard?.writeText(latestResultText) ?? Promise.reject()).catch(fallback).finally(() => { elements.resultSubtitle.textContent = "结果已复制"; });
}
function restoreSettings() {
  const validModes = ["allPeople", "selectedGroup", "groups", "groupThenPerson", "fullOrder"];
  const mode = validModes.includes(state.settings.mode) ? state.settings.mode : "allPeople";
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
  elements.count.value = String(state.settings.count || 1); elements.repeat.checked = Boolean(state.settings.allowRepeat);
  elements.orderTarget.value = state.settings.orderTarget === "groups" ? "groups" : "people";
}
function renderAll() { restoreSettings(); renderGroupList(); renderRosterCount(); renderHistory(); restoreLatestResult(); refreshControls(); persist(); }

elements.groupList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  const card = target.closest(".group-card"); const group = state.groups.find((item) => item.id === card?.dataset.id);
  if (!group || !target.dataset.field) return;
  group[target.dataset.field] = target.value; rosterChanged(card, group);
});
elements.groupList.addEventListener("click", (event) => {
  const memberButton = event.target.closest(".member-toggle");
  if (memberButton) {
    const card = memberButton.closest(".group-card"); const id = memberId(card.dataset.id, memberButton.dataset.member);
    state.inactivePeople = state.inactivePeople.includes(id) ? state.inactivePeople.filter((item) => item !== id) : [...state.inactivePeople, id];
    rosterChanged(); renderGroupList(); return;
  }
  const removeButton = event.target.closest(".remove-group"); if (!removeButton) return;
  const card = removeButton.closest(".group-card"); const group = state.groups.find((item) => item.id === card?.dataset.id);
  if (!group || !window.confirm(`删除“${group.name.trim() || "未命名小组"}”及其中成员？`)) return;
  state.groups = state.groups.filter((item) => item.id !== group.id); if (state.groups.length === 0) state.groups = [makeGroup()];
  rosterChanged(); renderGroupList();
});
elements.addGroup.addEventListener("click", () => { state.groups.push(makeGroup()); rosterChanged(); renderGroupList(); elements.groupList.lastElementChild?.querySelector(".group-name")?.focus(); });
document.querySelector("#mode-grid").addEventListener("change", () => { notice = ""; refreshControls(); persist(); });
elements.groupSelect.addEventListener("change", () => { refreshControls(); persist(); });
elements.orderTarget.addEventListener("change", () => { refreshControls(); persist(); });
elements.count.addEventListener("input", () => { notice = ""; refreshControls(); persist(); });
elements.repeat.addEventListener("change", () => { notice = ""; refreshControls(); persist(); });
elements.drawButton.addEventListener("click", startDraw); elements.resetRound.addEventListener("click", () => resetRound());
elements.openClear.addEventListener("click", () => elements.clearDialog.showModal());
elements.confirmClear.addEventListener("click", () => {
  state.groups = [makeGroup(), makeGroup()]; state.inactivePeople = []; clearRoundData(); notice = ''; renderHistory(); renderGroupList(); renderRosterCount();
  showPlaceholder("名单已清空<br />重新录入后即可抽签"); persist(); refreshControls();
});
function invalidatePreview() { importPreview = null; previewRegion.replaceChildren(); elements.confirmImport.disabled = true; elements.importError.textContent = ''; }
elements.importText.addEventListener('input', invalidatePreview);
elements.openImport.addEventListener("click", () => { invalidatePreview(); elements.importDialog.showModal(); elements.importText.focus(); });
previewButton.addEventListener('click', () => {
  importPreview = inspectRosterTable(elements.importText.value);
  const { groups, errors, warnings } = importPreview;
  const total = groups.reduce((sum, group) => sum + parseMembers(group.membersText).length, 0);
  previewRegion.textContent = `${groups.length} 个小组，${total} 名成员（同名小组合并，本轮进度保留）\n` + groups.map(group => `${group.name}：${parseMembers(group.membersText).join('、')}`).join('\n') + '\n' + warnings.join('\n');
  elements.importError.textContent = errors.join('\n') || (total ? '' : '未识别到名单，请提供小组和姓名两列');
  elements.confirmImport.disabled = Boolean(errors.length) || !total;
});
elements.confirmImport.addEventListener("click", (event) => {
  event.preventDefault();
  if (!importPreview || importPreview.errors.length || !importPreview.groups.length) return;
  mergeImportedGroups(importPreview.groups); elements.importText.value = ""; elements.importDialog.close(); rosterChanged(); renderGroupList(); invalidatePreview();
});
presentationDraw.addEventListener('click', startDraw);
elements.exportRoster.addEventListener("click", exportCsv); elements.copyResult.addEventListener("click", copyLatestResult);
elements.presentationMode.addEventListener("click", () => document.body.classList.toggle("is-presenting"));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.body.classList.remove("is-presenting"); });

renderAll();
