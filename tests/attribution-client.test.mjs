import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAttribution } from '../lib/attribution-client.js';

test('captures utm_source/medium/campaign from the URL', () => {
  const result = parseAttribution('?utm_source=twitter&utm_medium=social&utm_campaign=launch', '', 'bizzybotai.com');
  assert.deepEqual(result, {
    utmSource: 'twitter',
    utmMedium: 'social',
    utmCampaign: 'launch',
    referrerUrl: '',
  });
});

test('falls back to a simple ?ref= param when there is no utm_source', () => {
  const result = parseAttribution('?ref=friend-name', '', 'bizzybotai.com');
  assert.equal(result.utmSource, 'friend-name');
});

test('captures an external referrer (e.g. organic Google search)', () => {
  const result = parseAttribution('', 'https://www.google.com/search?q=ai+receptionist', 'bizzybotai.com');
  assert.equal(result.referrerUrl, 'https://www.google.com/search?q=ai+receptionist');
});

test('ignores a referrer from our own site (internal navigation, not real attribution)', () => {
  const result = parseAttribution('', 'https://bizzybotai.com/pricing', 'bizzybotai.com');
  assert.equal(result, null);
});

test('returns null when there is nothing worth recording (direct visit, no params, no referrer)', () => {
  const result = parseAttribution('', '', 'bizzybotai.com');
  assert.equal(result, null);
});

test('utm_source takes priority over ref when both are present', () => {
  const result = parseAttribution('?utm_source=newsletter&ref=friend-name', '', 'bizzybotai.com');
  assert.equal(result.utmSource, 'newsletter');
});
