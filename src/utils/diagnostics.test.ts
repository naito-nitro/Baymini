import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsEmoji,
  formatDiagnosticsReport,
  runCalendarIcsAndUrlCheck,
  runEmergencyDetectorCheck,
  runMapsUtilityCheck,
  runNormalizerResilienceCheck,
  runPastSlotBlockingCheck,
  runStoragePersistenceCheck,
} from './diagnostics';
import { STORAGE_KEY } from './storage';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

test('runStoragePersistenceCheck passes and restores prior localStorage state verbatim', () => {
  const storage = createMemoryStorage();
  const prior = JSON.stringify({
    version: 2,
    userLocation: { lat: 23.7465, lng: 90.376, label: 'Dhanmondi' },
  });
  storage.setItem(STORAGE_KEY, prior);

  const result = runStoragePersistenceCheck(storage);
  assert.equal(result.status, 'PASS');
  assert.equal(storage.getItem(STORAGE_KEY), prior);
});

test('all deterministic diagnostics checks pass with zero emojis in output', () => {
  const storage = createMemoryStorage();
  const checks = [
    runStoragePersistenceCheck(storage),
    runEmergencyDetectorCheck(),
    runNormalizerResilienceCheck(),
    runMapsUtilityCheck(),
    runCalendarIcsAndUrlCheck(),
    runPastSlotBlockingCheck(),
  ];

  for (const check of checks) {
    assert.equal(check.status, 'PASS', `${check.name} failed: ${check.detail}`);
    assert.equal(containsEmoji(check.name), false);
    assert.equal(containsEmoji(check.detail), false);
  }

  const report = formatDiagnosticsReport(checks, '2026-11-26T00:00:00.000Z');
  assert.equal(containsEmoji(report), false);
  assert.ok(report.includes('Summary: 6 PASS | 0 WARN | 0 FAIL'));
});
