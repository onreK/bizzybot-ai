import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRIAGE_CLASSES,
  conservativeReply,
  decideAction,
  buildTriagePrompt,
} from '../lib/intent-triage.js';

test('the five triage classes exist exactly', () => {
  assert.deepEqual(
    [...TRIAGE_CLASSES].sort(),
    ['ambiguous', 'automated', 'business_correspondence', 'existing_lead_reply', 'new_lead']
  );
});

test('only high-confidence lead classes earn an automatic reply', () => {
  assert.equal(decideAction({ class: 'new_lead', confidence: 'high' }).action, 'reply');
  assert.equal(decideAction({ class: 'existing_lead_reply', confidence: 'high' }).action, 'reply');
});

test('high-confidence business correspondence is flagged, never replied to', () => {
  assert.equal(decideAction({ class: 'business_correspondence', confidence: 'high' }).action, 'flag');
});

test('high-confidence automated is skipped silently', () => {
  assert.equal(decideAction({ class: 'automated', confidence: 'high' }).action, 'skip');
});

test('ALL uncertainty routes to the conservative reply + flag', () => {
  // medium/low confidence of ANY class, and the ambiguous class at any confidence
  assert.equal(decideAction({ class: 'new_lead', confidence: 'medium' }).action, 'conservative_reply');
  assert.equal(decideAction({ class: 'business_correspondence', confidence: 'low' }).action, 'conservative_reply');
  assert.equal(decideAction({ class: 'ambiguous', confidence: 'high' }).action, 'conservative_reply');
  assert.equal(decideAction({ class: 'automated', confidence: 'medium' }).action, 'conservative_reply');
});

test('an already-flagged thread never gets a second automatic reply', () => {
  const result = decideAction(
    { class: 'ambiguous', confidence: 'low' },
    { threadAlreadyFlagged: true }
  );
  assert.equal(result.action, 'flag');
});

test('garbage classification fails safe to conservative reply', () => {
  assert.equal(decideAction({ class: 'banana', confidence: 'high' }).action, 'conservative_reply');
  assert.equal(decideAction({}).action, 'conservative_reply');
});

test('conservative reply is content-free and carries the business name', () => {
  const reply = conservativeReply('Sunrise Solar');
  assert.ok(reply.includes('Sunrise Solar'));
  assert.ok(reply.includes('?'));           // asks a question
  assert.ok(!/price|quote|\$|book/i.test(reply)); // promises nothing
});

test('prompt includes the rich signals', () => {
  const { system, user } = buildTriagePrompt({
    subject: 'Wholesale panel pricing',
    body: 'We manufacture panels and would like to offer wholesale pricing.',
    fromEmail: 'sales@panelcorp.com',
    fromName: 'Panel Corp',
    isReplyToOurThread: false,
    isExistingContact: false,
    contactSummary: '',
    businessName: 'Sunrise Solar',
    industry: 'Solar installation',
    businessDescription: 'Residential solar installer',
    corrections: [{ fromEmail: 'joe@vendor.com', subject: 'Invoice', bodySnippet: 'attached invoice', correctedClass: 'business_correspondence' }],
  });
  assert.ok(system.includes('new_lead'));
  assert.ok(system.includes('business_correspondence'));
  assert.ok(user.includes('Sunrise Solar'));
  assert.ok(user.includes('sales@panelcorp.com'));
  assert.ok(user.includes('role address'));          // sales@ detected
  assert.ok(user.includes('corporate domain'));      // not freemail
  assert.ok(user.includes('joe@vendor.com'));        // correction injected
  assert.ok(user.includes('Wholesale panel pricing'));
});

test('prompt flags freemail senders and replies to our own threads', () => {
  const { user } = buildTriagePrompt({
    subject: 'Re: your quote',
    body: 'Sounds good, when can you come out?',
    fromEmail: 'jane.doe@gmail.com',
    fromName: 'Jane Doe',
    isReplyToOurThread: true,
    isExistingContact: true,
    contactSummary: 'Existing contact, lead score 55 (warm)',
    businessName: 'Sunrise Solar',
    industry: '',
    businessDescription: '',
    corrections: [],
  });
  assert.ok(user.includes('personal/freemail'));
  assert.ok(user.includes('REPLY to a thread'));
  assert.ok(user.includes('lead score 55'));
});

test('buildTriagePrompt with null values does not throw', () => {
  const result = buildTriagePrompt({
    subject: null,
    body: null,
    fromEmail: null,
    fromName: null,
    businessName: null,
    industry: null,
    businessDescription: null,
    contactSummary: null,
  });
  assert.ok(result.system);
  assert.ok(result.user);
  assert.ok(typeof result.system === 'string');
  assert.ok(typeof result.user === 'string');
});

test('decideAction(null) fails safe to conservative_reply', () => {
  assert.equal(decideAction(null).action, 'conservative_reply');
});
