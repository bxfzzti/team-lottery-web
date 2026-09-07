import { buildCandidatePool, drawItems, parseMembers, secureRandomIndex } from "./domain.js";
import { createStorage } from "./storage.js";

const storage = createStorage(window.localStorage);
const elements = {
  groupList: document.querySelector("#group-list"),
  rosterCount: document.querySelector("#roster-count"),
  addGroup: document.querySelector("#add-group"),
  openClear: document.querySelector("#open-clear"),
  clearDialog: document.querySelector("#clear-dialog"),
  confirmClear: document.querySelector("#confirm-clear"),
  groupSelectField: document.querySelector("#group-select-field"),
  groupSelect: document.querySelector("#group-select"),
  countField: document.querySelector("#count-field"),
  count: document.querySelector("#draw-count"),
  repeat: document.querySelector("#allow-repeat"),
  availability: document.querySelector("#availability"),
  drawButton: document.querySelector("#draw-button"),
  resetRound: document.querySelector("#reset-round"),
  resultStage: document.querySelector("#result-stage"),
  resultLabel: document.querySelector("#result-label"),
  resultContent: document.querySelector("#result-content"),
  resultSubtitle: document.querySelector("#result-subtitle"),
  historyList: document.querySelector("#history-list"),
  historyCount: document.querySelector("#history-count"),
};

let idSequence = 0;
let state = storage.load();
if (state.groups.length === 0) state.groups = [makeGroup(), makeGroup()];

const round = {
  excludedPeople: new Set(),
  excludedGroups: new Set(),
  history: [],
  busy: false,
};

function makeGroup() {
  idSequence += 1;
  return {
    id: globalThis.crypto.randomUUID?.() ?? `group-${Date.now()}-${idSequence}`,
    name: "",
    membersText: "",
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function currentMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function selectedGroupId() {
  return elements.groupSelect.value || state.groups[0]?.id || "";
}

function modeName(mode) {
  return {
    allPeople: "全员抽人",
    selectedGroup: "指定组抽人",
    groups: "抽小组",
    groupThenPerson: "先抽组，再抽人",
  }[mode];
}

function saveRoster() {
  storage.save({ groups: state.groups });
}

function memberCount(group) {
  return parseMembers(group.membersText).length;
}

function rawMemberCount(group) {
  return String(group.membersText)
    .split(/[\n\r,，、;；]+/u)
    .map((name) => name.trim())
    .filter(Boolean).length;
}

function renderGroupList() {
  elements.groupList.innerHTML = state.groups.map((group, index) => {
    const members = memberCount(group);
    const raw = rawMemberCount(group);
    const duplicateNote = raw > members ? `已合并 ${raw - members} 个重复姓名` : "支持批量粘贴";
    return `<article class="group-card" data-id="${escapeHtml(group.id)}" data-index="${String(index + 1).padStart(2, "0")}">
      <div class="group-card-head">
        <input class="group-name" data-field="name" aria-label="第 ${index + 1} 个小组名称" value="${escapeHtml(group.name)}" placeholder="例如：产品组" maxlength="30" />
        <button class="icon-button remove-group" type="button" aria-label="删除小组">×</button>
      </div>
      <textarea data-field="membersText" aria-label="${escapeHtml(group.name || "小组")}成员名单" placeholder="每行一个姓名；也可以用逗号、顿号分隔">${escapeHtml(group.membersText)}</textarea>
      <div class="group-meta"><span>${members} 名成员</span><span>${duplicateNote}</span></div>
    </article>`;
  }).join("");
}

function renderRosterCount() {
  const people = state.groups.reduce((total, group) => total + memberCount(group), 0);
  const nonEmptyGroups = state.groups.filter((group) => memberCount(group) > 0).length;
  elements.rosterCount.textContent = `${people} 人 / ${nonEmptyGroups} 组`;
}

function currentPools() {
  const mode = currentMode();
  const allowRepeat = elements.repeat.checked;
  if (mode === "groupThenPerson") {
    const allGroups = buildCandidatePool(state.groups, "groups");
    const groups = allGroups.filter((group) => {
      if (!allowRepeat && round.excludedGroups.has(group.id)) return false;
      const people = buildCandidatePool(state.groups, "selectedGroup", group.id);
      return people.some((person) => allowRepeat || !round.excludedPeople.has(person.id));
    });
    return { pool: groups, excluded: new Set(), mode };
  }
  const sourceMode = mode === "selectedGroup" ? "selectedGroup" : mode;
  const pool = buildCandidatePool(state.groups, sourceMode, selectedGroupId());
  const excluded = allowRepeat ? new Set() : mode === "groups" ? round.excludedGroups : round.excludedPeople;
  return { pool, excluded, mode };
}

function availableCandidates() {
  const { pool, excluded } = currentPools();
  return pool.filter((candidate) => !excluded.has(candidate.id));
}

function refreshControls() {
  const previouslySelected = elements.groupSelect.value;
  elements.groupSelect.innerHTML = state.groups
    .map((group, index) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name.trim() || `未命名小组 ${index + 1}`)} · ${memberCount(group)} 人</option>`)
    .join("");
  if (state.groups.some((group) => group.id === previouslySelected)) elements.groupSelect.value = previouslySelected;

  const mode = currentMode();
  elements.groupSelectField.classList.toggle("is-hidden", mode !== "selectedGroup");
  elements.countField.classList.toggle("is-hidden", mode === "groupThenPerson");

  const available = availableCandidates();
  const max = Math.max(available.length, 1);
  if (mode === "groupThenPerson") elements.count.value = "1";
  elements.count.max = String(max);
  if (Number(elements.count.value) > max) elements.count.value = String(max);
  if (Number(elements.count.value) < 1 || !Number.isFinite(Number(elements.count.value))) elements.count.value = "1";

  let message = "";
  if (mode === "groupThenPerson") {
    message = available.length ? `可参与第一步抽取：${available.length} 个小组` : "没有可继续抽取的小组";
  } else if (available.length) {
    message = `当前有 ${available.length} 个有效候选${elements.repeat.checked ? "；已开启重复抽取" : "；本轮不重复"}`;
  } else {
    message = "请先录入有效的成员或小组名单";
  }
  const count = Number(elements.count.value);
  const invalidCount = mode !== "groupThenPerson" && count > available.length;
  if (invalidCount) message = `候选对象不足：最多可抽 ${available.length} 个`;
  elements.availability.textContent = message;
  elements.availability.classList.toggle("is-error", available.length === 0 || invalidCount);
  elements.drawButton.disabled = round.busy || available.length === 0 || invalidCount;
}

function renderHistory() {
  elements.historyCount.textContent = `${round.history.length} 次`;
  if (round.history.length === 0) {
    elements.historyList.innerHTML = '<li class="history-empty">还没有抽签记录</li>';
    return;
  }
  elements.historyList.innerHTML = round.history.slice(0, 8).map((entry) => `<li class="history-item">
    <span class="history-mode">${escapeHtml(entry.mode)}</span>
    <span class="history-result">${escapeHtml(entry.result)}</span>
    <time class="history-time">${escapeHtml(entry.time)}</time>
  </li>`).join("");
}

function showPlaceholder(message = "名单准备好后<br />点击开始抽签") {
  elements.resultStage.classList.remove("is-revealed", "is-drawing");
  elements.resultLabel.textContent = "等待开始";
  elements.resultContent.innerHTML = `<span class="result-placeholder">${message}</span>`;
  elements.resultSubtitle.textContent = "结果将在这里公开展示";
}

function resetRound(showMessage = true) {
  round.excludedPeople.clear();
  round.excludedGroups.clear();
  round.history = [];
  renderHistory();
  if (showMessage) showPlaceholder("本轮已重置<br />所有对象重新参与");
  refreshControls();
}

function rosterChanged() {
  saveRoster();
  resetRound(false);
  renderRosterCount();
  refreshControls();
}

function resultMarkup(results, isTwoStep) {
  return `<div class="winner-list">${results.map((winner) => `<span class="winner">${escapeHtml(winner.name)}<small>${isTwoStep && winner.type === "group" ? "第一步抽中小组" : winner.type === "group" ? "抽中小组" : escapeHtml(winner.groupName)}</small></span>`).join("")}</div>`;
}

function addHistory(mode, results, isTwoStep) {
  const result = isTwoStep
    ? `${results[0].name} · ${results[1].name}`
    : results.map((item) => item.name).join("、");
  round.history.unshift({
    mode: modeName(mode),
    result,
    time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
  });
  renderHistory();
}

function applyExclusions(results) {
  if (elements.repeat.checked) return;
  results.forEach((result) => {
    if (result.type === "group") round.excludedGroups.add(result.id);
    else round.excludedPeople.add(result.id);
  });
}

function completeDraw({ mode, results, isTwoStep }) {
  elements.resultStage.classList.remove("is-drawing");
  elements.resultStage.classList.add("is-revealed");
  elements.resultLabel.textContent = isTwoStep ? "抽签结果 / 小组 → 成员" : "抽签结果";
  elements.resultContent.innerHTML = resultMarkup(results, isTwoStep);
  elements.resultSubtitle.textContent = elements.repeat.checked ? "本次为允许重复抽取" : "已抽中对象将在本轮中自动避开";
  applyExclusions(results);
  addHistory(mode, results, isTwoStep);
  round.busy = false;
  refreshControls();
}

function animateAndReveal(payload, previewPool) {
  round.busy = true;
  refreshControls();
  elements.resultStage.classList.remove("is-revealed");
  elements.resultStage.classList.add("is-drawing");
  elements.resultLabel.textContent = "正在抽取，请看屏幕";
  elements.resultSubtitle.textContent = "结果已先计算，动画不改变随机结果";
  let cursor = 0;
  const preview = () => {
    const candidate = previewPool[cursor % previewPool.length];
    cursor += 1;
    elements.resultContent.innerHTML = `<span>${escapeHtml(candidate.name)}</span>`;
  };
  preview();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    completeDraw(payload);
    return;
  }
  const interval = window.setInterval(preview, 75);
  window.setTimeout(() => {
    window.clearInterval(interval);
    completeDraw(payload);
  }, 1100);
}

function startDraw() {
  if (round.busy) return;
  const { pool, excluded, mode } = currentPools();
  try {
    let results;
    let isTwoStep = false;
    if (mode === "groupThenPerson") {
      const group = drawItems(pool, 1, excluded, secureRandomIndex)[0];
      const people = buildCandidatePool(state.groups, "selectedGroup", group.id);
      const personExcluded = elements.repeat.checked ? new Set() : round.excludedPeople;
      const person = drawItems(people, 1, personExcluded, secureRandomIndex)[0];
      results = [group, person];
      isTwoStep = true;
    } else {
      results = drawItems(pool, Number(elements.count.value), excluded, secureRandomIndex);
    }
    animateAndReveal({ mode, results, isTwoStep }, pool);
  } catch (error) {
    elements.availability.textContent = error.message;
    elements.availability.classList.add("is-error");
  }
}

function renderAll() {
  renderGroupList();
  renderRosterCount();
  refreshControls();
  renderHistory();
}

elements.groupList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  const card = target.closest(".group-card");
  const group = state.groups.find((item) => item.id === card?.dataset.id);
  const field = target.dataset.field;
  if (!group || !field) return;
  group[field] = target.value;
  rosterChanged();
});

elements.groupList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-group");
  if (!button) return;
  const card = button.closest(".group-card");
  const group = state.groups.find((item) => item.id === card?.dataset.id);
  if (!group) return;
  if (!window.confirm(`删除“${group.name.trim() || "未命名小组"}”及其中成员？`)) return;
  state.groups = state.groups.filter((item) => item.id !== group.id);
  if (state.groups.length === 0) state.groups = [makeGroup()];
  rosterChanged();
  renderGroupList();
});

elements.addGroup.addEventListener("click", () => {
  state.groups.push(makeGroup());
  rosterChanged();
  renderGroupList();
  elements.groupList.lastElementChild?.querySelector(".group-name")?.focus();
});

document.querySelector("#mode-grid").addEventListener("change", refreshControls);
elements.groupSelect.addEventListener("change", refreshControls);
elements.count.addEventListener("input", refreshControls);
elements.repeat.addEventListener("change", refreshControls);
elements.drawButton.addEventListener("click", startDraw);
elements.resetRound.addEventListener("click", () => resetRound());
elements.openClear.addEventListener("click", () => elements.clearDialog.showModal());
elements.confirmClear.addEventListener("click", () => {
  state.groups = [makeGroup(), makeGroup()];
  storage.clear();
  rosterChanged();
  renderGroupList();
  showPlaceholder("名单已清空<br />重新录入后即可抽签");
});

renderAll();
