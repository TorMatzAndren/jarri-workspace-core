let sequence = 0;

export function createId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

