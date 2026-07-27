import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldAppendCompliance,
  complianceFooter,
  applyComplianceFooter,
  COMPLIANCE_INTERVAL,
} from '../lib/sms-compliance.js';

test('the footer carries both things Twilio requires: business name and opt-out', () => {
  const footer = complianceFooter('BizzyBot');
  assert.match(footer, /BizzyBot/);
  assert.match(footer, /Reply STOP to opt out/i);
});

test('the footer wording matches the approved TFV message sample', () => {
  // Twilio requires the opt-in method, use case and sample messages to "tell a
  // consistent story". lib/tollfree-verification.js submitted exactly this
  // phrasing, so live traffic must not drift from it.
  assert.match(complianceFooter('X'), /Reply STOP to opt out, HELP for help\./);
});

test('the footer still discloses opt-out when no business name is configured', () => {
  const footer = complianceFooter('');
  assert.match(footer, /Reply STOP to opt out/i);
  assert.equal(footer.includes('undefined'), false);
  assert.equal(footer.includes('null'), false);
});

test('appended on the first message of a conversation', () => {
  assert.equal(shouldAppendCompliance(0), true);
});

test('NOT appended on ordinary follow-up messages', () => {
  for (const n of [1, 2, 3, 5, 9, 11, 15]) {
    assert.equal(shouldAppendCompliance(n), false, `should not append at ${n}`);
  }
});

test('re-appended at regular intervals through a long conversation', () => {
  assert.equal(shouldAppendCompliance(COMPLIANCE_INTERVAL), true);
  assert.equal(shouldAppendCompliance(COMPLIANCE_INTERVAL * 2), true);
  assert.equal(shouldAppendCompliance(COMPLIANCE_INTERVAL * 3), true);
});

test('an unknown or broken message count discloses rather than staying silent', () => {
  // Failing safe matters here: the cost of an extra disclosure is one line of
  // text, the cost of missing one is carrier filtering.
  for (const bad of [undefined, null, NaN, -1, 'abc', {}]) {
    assert.equal(shouldAppendCompliance(bad), true, `should append for ${JSON.stringify(bad)}`);
  }
});

test('applyComplianceFooter appends on the first message', () => {
  const out = applyComplianceFooter('We open at 8am.', { businessName: 'BizzyBot', priorOutboundCount: 0 });
  assert.equal(out, 'We open at 8am.\n\n— BizzyBot. Reply STOP to opt out, HELP for help.');
});

test('applyComplianceFooter leaves ordinary later messages untouched', () => {
  const body = 'Yes, Thursday at 2pm works.';
  assert.equal(applyComplianceFooter(body, { businessName: 'BizzyBot', priorOutboundCount: 3 }), body);
});

test('applyComplianceFooter never doubles the disclosure', () => {
  const already = 'Hi there. Reply STOP to opt out, HELP for help.';
  assert.equal(applyComplianceFooter(already, { businessName: 'BizzyBot', priorOutboundCount: 0 }), already);
});

test('applyComplianceFooter does not decorate an empty body', () => {
  assert.equal(applyComplianceFooter('', { businessName: 'BizzyBot', priorOutboundCount: 0 }), '');
  assert.equal(applyComplianceFooter('   ', { businessName: 'BizzyBot', priorOutboundCount: 0 }), '   ');
});

test('applyComplianceFooter survives a missing options object', () => {
  const out = applyComplianceFooter('Hello.');
  assert.match(out, /Reply STOP to opt out/i);
});

test('the footer is short enough not to blow out an SMS segment budget', () => {
  assert.ok(complianceFooter('A Reasonably Long Business Name LLC').length < 100);
});
