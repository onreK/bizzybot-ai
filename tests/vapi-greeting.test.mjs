import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFirstMessage, RECORDING_NOTICE } from '../lib/vapi.js';

test('every greeting discloses that the call is recorded', () => {
  // The notice is what makes recording lawful in all-party-consent states.
  // Every call is recorded, so every greeting must say so.
  assert.match(buildFirstMessage('Acme Plumbing'), /this call is recorded/i);
});

test('the greeting reads naturally: welcome, notice, then the offer to help', () => {
  assert.equal(
    buildFirstMessage('Acme Plumbing'),
    'Hi there! Thanks for calling Acme Plumbing. Just so you know, this call is recorded. How can I help you today?'
  );
});

test('a custom greeting still gets the notice appended', () => {
  // A customer cannot opt out of the disclosure by writing their own greeting.
  const out = buildFirstMessage('Acme', 'Acme Plumbing, how can we help?');
  assert.match(out, /this call is recorded/i);
  assert.match(out, /^Acme Plumbing, how can we help\?/);
});

test('a greeting that already mentions recording is not made to say it twice', () => {
  const already = 'Thanks for calling. Calls are recorded for your protection.';
  assert.equal(buildFirstMessage('Acme', already), already);
  const alsoAlready = 'Thanks for calling — this call is being recorded.';
  assert.equal(buildFirstMessage('Acme', alsoAlready), alsoAlready);
});

test('a missing business name still produces a sensible spoken greeting', () => {
  const out = buildFirstMessage('');
  assert.match(out, /this call is recorded/i);
  assert.equal(out.includes('undefined'), false);
  assert.equal(out.includes('null'), false);
  assert.match(out, /calling us\./);
});

test('the notice is short enough not to make callers wait', () => {
  // Roughly two seconds of speech. A long legal preamble is the thing this
  // wording exists to avoid.
  assert.ok(RECORDING_NOTICE.split(/\s+/).length <= 9, RECORDING_NOTICE);
});

test('the notice avoids corporate phrasing that makes callers brace', () => {
  assert.equal(/quality assurance|training purposes|monitored/i.test(RECORDING_NOTICE), false);
});
