/**
 * Cloud mode detection.
 * Cloud mode is enabled when OPENACE_CLOUD=true is set.
 * In the future, this will connect to your own backend platform.
 * For now, cloud mode uses SQLite + JWT (zero external deps).
 */

export function isCloudMode() {
  return process.env.OPENACE_CLOUD === 'true';
}
