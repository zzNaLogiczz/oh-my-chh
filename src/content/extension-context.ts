const EXTENSION_CONTEXT_INVALIDATED = /extension context invalidated|context invalidated/i;

export function isExtensionContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return EXTENSION_CONTEXT_INVALIDATED.test(message);
}

export function warnForUnexpectedExtensionError(message: string, error: unknown): void {
  if (isExtensionContextInvalidated(error)) return;
  console.warn(message, error);
}
