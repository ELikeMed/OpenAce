/**
 * Migration 001 — Initial schema baseline.
 * No-op: establishes schema version 1 as the starting point.
 */

export default {
  version: 1,
  description: 'Initial schema baseline',
  async up() {
    // No changes needed — this sets the baseline
  },
  async down() {
    // Nothing to revert
  },
};
