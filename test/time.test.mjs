import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocalTime } from '../app/time.js';

test('Berlin uses local time and day before month for EU locales', () => {
  const value = formatLocalTime('2026-11-12T23:03:00.000Z', 'en-GB', 'Europe/Berlin');
  assert.match(value, /13\/11\/2026/);
  assert.match(value, /00:03:00/);
});
test('Auckland crosses midnight in its local zone', () => {
  const value = formatLocalTime('2026-11-12T23:03:00.000Z', 'en-NZ', 'Pacific/Auckland');
  assert.match(value, /13\/11\/2026/);
  assert.match(value, /12:03:00/);
});
test('US locale keeps its own date order', () => {
  const value = formatLocalTime('2026-11-12T03:03:00.000Z', 'en-US', 'America/New_York');
  assert.match(value, /11\/11\/2026/);
  assert.match(value, /10:03:00/);
});
