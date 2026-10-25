// The list lives on this phone only (localStorage). Nothing is sent anywhere.

const KEY = "just-one.v1";

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s && Array.isArray(s.tasks)) return { tasks: s.tasks, today: s.today ?? null };
  } catch {
    // private window or storage blocked
  }
  return { tasks: [], today: null };
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tasks: state.tasks, today: state.today }));
    return true;
  } catch {
    return false;
  }
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
