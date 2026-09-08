const VERSION = 2;

function emptyState() {
  return {
    groups: [],
    inactivePeople: [],
    settings: {
      mode: "allPeople",
      selectedGroupId: "",
      count: 1,
      allowRepeat: false,
      orderTarget: "people",
    },
    round: {
      excludedPeople: [],
      excludedGroups: [],
      history: [],
    },
  };
}

function isValidState(state) {
  return Boolean(
    state
      && Array.isArray(state.groups)
      && state.groups.every((group) =>
        group
          && typeof group.id === "string"
          && typeof group.name === "string"
          && typeof group.membersText === "string"),
  );
}

function normalizeState(state) {
  const defaults = emptyState();
  return {
    ...defaults,
    ...state,
    inactivePeople: Array.isArray(state.inactivePeople) ? state.inactivePeople : [],
    settings: { ...defaults.settings, ...(state.settings ?? {}) },
    round: {
      ...defaults.round,
      ...(state.round ?? {}),
      excludedPeople: Array.isArray(state.round?.excludedPeople) ? state.round.excludedPeople : [],
      excludedGroups: Array.isArray(state.round?.excludedGroups) ? state.round.excludedGroups : [],
      history: Array.isArray(state.round?.history) ? state.round.history : [],
    },
  };
}

export function createStorage(adapter, key = "team-lottery-state") {
  return {
    load() {
      try {
        const raw = adapter.getItem(key);
        if (!raw) return emptyState();
        const payload = JSON.parse(raw);
        if (![1, VERSION].includes(payload.version) || !isValidState(payload.state)) {
          return emptyState();
        }
        return normalizeState(payload.state);
      } catch {
        return emptyState();
      }
    },

    save(state) {
      try {
        adapter.setItem(key, JSON.stringify({ version: VERSION, state }));
        return true;
      } catch {
        return false;
      }
    },

    clear() {
      try {
        adapter.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
