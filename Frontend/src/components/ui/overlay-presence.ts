let openCount = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeOverlayPresence(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOpenOverlayCount() {
  return openCount;
}

export function registerOverlay() {
  openCount += 1;
  emit();
  return () => {
    openCount -= 1;
    emit();
  };
}
