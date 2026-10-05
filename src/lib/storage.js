const KEY = "adpa-claims-workspace-v1";

export function loadWorkspace() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWorkspace(value) {
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function uid(prefix = "id") {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export function nowIso() {
  return new Date().toISOString();
}
