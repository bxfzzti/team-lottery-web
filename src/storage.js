const VERSION = 1;
const EMPTY_STATE = Object.freeze({ groups: [] });

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

export function createStorage(adapter, key = "team-lottery-state") {
  return {
    load() {
      try {
        const raw = adapter.getItem(key);
        if (!raw) return { ...EMPTY_STATE };
        const payload = JSON.parse(raw);
        if (payload.version !== VERSION || !isValidState(payload.state)) {
          return { ...EMPTY_STATE };
        }
        return payload.state;
      } catch {
        return { ...EMPTY_STATE };
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
