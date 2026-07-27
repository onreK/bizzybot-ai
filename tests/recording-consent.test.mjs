import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  areaCodeOf,
  mayKeepRecording,
  ALL_PARTY_AREA_CODES,
} from '../lib/recording-consent.js';

test('areaCodeOf reads the area code from every format a number arrives in', () => {
  for (const n of ['+18583336871', '18583336871', '8583336871', '(858) 333-6871', '858-333-6871']) {
    assert.equal(areaCodeOf(n), '858', `failed for ${n}`);
  }
});

test('areaCodeOf rejects anything that is not a NANP number', () => {
  // Non-US, too short, too long, empty, and codes starting 0 or 1 (never valid).
  for (const n of ['+442071234567', '12345', '', null, undefined, '+1123456789012', '0585551234']) {
    assert.equal(areaCodeOf(n), null, `should be null for ${JSON.stringify(n)}`);
  }
});

test('recordings are KEPT for callers in one-party states', () => {
  // Virginia (BizzyBot's own state), Texas, New York, Georgia, Ohio.
  for (const n of ['+18045551212', '+12145551212', '+12125551212', '+14045551212', '+16145551212']) {
    assert.equal(mayKeepRecording(n), true, `should keep for ${n}`);
  }
});

test('recordings are DISCARDED for callers in all-party states', () => {
  const cases = [
    ['+14155551212', 'California'],
    ['+13055551212', 'Florida'],
    ['+13125551212', 'Illinois'],
    ['+12065551212', 'Washington'],
    ['+12155551212', 'Pennsylvania'],
    ['+16175551212', 'Massachusetts'],
    ['+17025551212', 'Nevada'],
    ['+14065551212', 'Montana'],
    ['+16035551212', 'New Hampshire'],
    ['+13025551212', 'Delaware'],
    ['+15035551212', 'Oregon'],
    ['+12485551212', 'Michigan'],
    ['+14105551212', 'Maryland'],
    ['+12035551212', 'Connecticut'],
  ];
  for (const [n, state] of cases) {
    assert.equal(mayKeepRecording(n), false, `should discard for ${state} (${n})`);
  }
});

test('every all-party state is represented in the list', () => {
  // One known code per state — a regression guard against a state being
  // dropped from the set during an edit.
  const oneCodePerState = ['415','203','302','305','312','410','617','248','406','702','603','503','215','206'];
  for (const code of oneCodePerState) {
    assert.equal(ALL_PARTY_AREA_CODES.has(code), true, `missing area code ${code}`);
  }
});

test('FAILS CLOSED for anything whose location cannot be established', () => {
  // The cost of wrongly keeping a recording is legal; the cost of wrongly
  // discarding one is a missing audio file. Every uncertain case discards.
  const uncertain = [
    null, undefined, '', '   ',            // withheld / missing caller ID
    '+442071234567',                        // non-US
    '+18005551212', '+18885551212',         // toll-free — no location at all
    '+18335551212', '+18445551212', '+18555551212', '+18665551212', '+18775551212',
    '+19005551212',                         // premium
    'not a phone', '12345', 0, {},          // malformed
  ];
  for (const n of uncertain) {
    assert.equal(mayKeepRecording(n), false, `should discard for ${JSON.stringify(n)}`);
  }
});

test('no area code appears in the all-party list twice over', () => {
  // A Set would silently swallow a duplicate; this pins the count so an
  // accidental paste of the same state twice is visible.
  assert.ok(ALL_PARTY_AREA_CODES.size > 100, 'list looks truncated');
  assert.ok(ALL_PARTY_AREA_CODES.size < 200, 'list looks over-broad');
});
