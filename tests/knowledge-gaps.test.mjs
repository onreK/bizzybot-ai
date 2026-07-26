import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAP_TOPICS,
  normalizeTopic,
  extractKnowledgeGap,
  stripGapMarkers,
} from '../lib/knowledge-gaps.js';

test('the topic vocabulary is the nine agreed topics', () => {
  assert.deepEqual(GAP_TOPICS, [
    'pricing', 'service_area', 'hours', 'scheduling',
    'services', 'process', 'warranty', 'payment', 'other',
  ]);
});

test('normalizeTopic accepts a known topic and lowercases it', () => {
  assert.equal(normalizeTopic('Service_Area'), 'service_area');
});

test('normalizeTopic falls back to other for anything unrecognized', () => {
  assert.equal(normalizeTopic('roof_color'), 'other');
  assert.equal(normalizeTopic(''), 'other');
  assert.equal(normalizeTopic(null), 'other');
});

test('extractKnowledgeGap pulls topic and question from a well-formed marker', () => {
  const text = 'Let me check on that! [UNKNOWN:service_area|Do you service Chesterfield?]';
  assert.deepEqual(extractKnowledgeGap(text), {
    topic: 'service_area',
    question: 'Do you service Chesterfield?',
  });
});

test('extractKnowledgeGap maps an unknown topic to other but keeps the question', () => {
  const text = '[UNKNOWN:llamas|Do you groom llamas?]';
  assert.deepEqual(extractKnowledgeGap(text), {
    topic: 'other',
    question: 'Do you groom llamas?',
  });
});

test('extractKnowledgeGap returns null when there is no marker', () => {
  assert.equal(extractKnowledgeGap('We are open 9-5 Monday to Friday.'), null);
});

test('extractKnowledgeGap returns null for a marker with an empty question', () => {
  assert.equal(extractKnowledgeGap('Sure thing. [UNKNOWN:pricing|]'), null);
});

test('stripGapMarkers removes a well-formed marker and trailing whitespace', () => {
  const text = 'I want to get you the right answer on that. [UNKNOWN:pricing|What does a tune-up cost?]';
  assert.equal(stripGapMarkers(text), 'I want to get you the right answer on that.');
});

test('stripGapMarkers removes an UNCLOSED marker (SMS truncation can chop the bracket)', () => {
  const text = 'Let me find out for you. [UNKNOWN:pricing|What does a tune-u';
  assert.equal(stripGapMarkers(text), 'Let me find out for you.');
});

test('stripGapMarkers removes a marker that appears mid-sentence', () => {
  const text = 'Let me check [UNKNOWN:hours|are you open Sunday?] and get back to you.';
  assert.equal(stripGapMarkers(text), 'Let me check and get back to you.');
});

test('stripGapMarkers removes MULTIPLE markers', () => {
  const text = 'One [UNKNOWN:pricing|cost?] and two [UNKNOWN:hours|open?] done.';
  assert.equal(stripGapMarkers(text), 'One and two done.');
});

test('stripGapMarkers removes a marker missing its topic separator', () => {
  const text = 'Checking. [UNKNOWN whatever this is]';
  assert.equal(stripGapMarkers(text), 'Checking.');
});

test('stripGapMarkers leaves normal bracketed text alone', () => {
  const text = 'Our hours [Monday-Friday] are 9-5.';
  assert.equal(stripGapMarkers(text), 'Our hours [Monday-Friday] are 9-5.');
});

test('stripGapMarkers handles empty and null input without throwing', () => {
  assert.equal(stripGapMarkers(''), '');
  assert.equal(stripGapMarkers(null), '');
});

test('nothing resembling a marker survives stripping, whatever the shape', () => {
  const nasties = [
    '[UNKNOWN:pricing|q]', '[UNKNOWN:pricing|q', '[UNKNOWN', '[UNKNOWN]',
    '[UNKNOWN:|]', 'text [UNKNOWN:a|b] more [UNKNOWN:c|d]',
    '[UNKNOWN:pricing|a [Bronze] tier?]', '[UNKNOWN:a|b [c] d',
  ];
  for (const n of nasties) {
    assert.equal(stripGapMarkers(`Hello ${n}`).includes('UNKNOWN'), false, `leaked: ${n}`);
  }
});

test('stripGapMarkers removes a marker whose question text contains brackets', () => {
  const text = 'Let me check on that. [UNKNOWN:pricing|Do you offer a [Bronze] tier discount?] I will follow up.';
  const result = stripGapMarkers(text);
  assert.equal(result, 'Let me check on that. I will follow up.');
  assert.equal(result.includes(']'), false);
});

test('extractKnowledgeGap keeps the whole question when it contains brackets', () => {
  const text = '[UNKNOWN:pricing|Do you offer a [Bronze] tier discount?]';
  assert.deepEqual(extractKnowledgeGap(text), {
    topic: 'pricing',
    question: 'Do you offer a [Bronze] tier discount?',
  });
});

import { groupGapRows } from '../lib/knowledge-gaps-store.js';

test('groupGapRows groups rows by topic with counts, newest topic group first', () => {
  const rows = [
    { id: 1, topic: 'service_area', question: 'Do you cover Chesterfield?', channel: 'sms',
      contact_name: 'Mike', contact_email: null, contact_phone: '+18045551212',
      created_at: '2026-07-24T10:00:00Z', followup_at: null, followup_method: null },
    { id: 2, topic: 'service_area', question: 'Are you out in Midlothian?', channel: 'chat',
      contact_name: null, contact_email: null, contact_phone: null,
      created_at: '2026-07-25T10:00:00Z', followup_at: null, followup_method: null },
    { id: 3, topic: 'warranty', question: 'How long is the labor warranty?', channel: 'sms',
      contact_name: 'Mike', contact_email: null, contact_phone: '+18045551212',
      created_at: '2026-07-26T10:00:00Z', followup_at: null, followup_method: null },
  ];
  const grouped = groupGapRows(rows);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].topic, 'warranty');        // most recent activity first
  assert.equal(grouped[0].count, 1);
  assert.equal(grouped[1].topic, 'service_area');
  assert.equal(grouped[1].count, 2);
  assert.equal(grouped[1].label, 'Service area');
  assert.equal(grouped[1].questions[0].question, 'Are you out in Midlothian?'); // newest first
});

test('groupGapRows returns an empty array for no rows', () => {
  assert.deepEqual(groupGapRows([]), []);
});

test('groupGapRows carries follow-up state through so the UI can show handled leads', () => {
  const rows = [
    { id: 9, topic: 'pricing', question: 'Cost?', channel: 'sms',
      contact_name: 'Dana', contact_email: null, contact_phone: '+18045551213',
      created_at: '2026-07-26T10:00:00Z', followup_at: '2026-07-26T12:00:00Z', followup_method: 'manual' },
  ];
  const grouped = groupGapRows(rows);
  assert.equal(grouped[0].questions[0].followupMethod, 'manual');
});

import { buildKnowledgeEntry } from '../lib/knowledge-gaps-store.js';

test('buildKnowledgeEntry formats a Q&A pair for the knowledge base', () => {
  const entry = buildKnowledgeEntry('Do you service Chesterfield?', 'Yes — Chesterfield, Richmond and Henrico.');
  assert.equal(entry, 'Q: Do you service Chesterfield?\nA: Yes — Chesterfield, Richmond and Henrico.');
});

test('buildKnowledgeEntry trims surrounding whitespace from both parts', () => {
  const entry = buildKnowledgeEntry('  Cost?  ', '  About $200.  ');
  assert.equal(entry, 'Q: Cost?\nA: About $200.');
});

test('buildKnowledgeEntry adds a question mark only when the question lacks end punctuation', () => {
  assert.equal(buildKnowledgeEntry('Do you cover Powhatan', 'Yes'), 'Q: Do you cover Powhatan?\nA: Yes');
  assert.equal(buildKnowledgeEntry('Do you cover Powhatan?', 'Yes'), 'Q: Do you cover Powhatan?\nA: Yes');
  assert.equal(buildKnowledgeEntry('Tell me your hours.', '9-5'), 'Q: Tell me your hours.\nA: 9-5');
});

import { parseTranscriptScan, buildTranscriptScanPrompt, buildVoiceGapInstruction } from '../lib/knowledge-gaps.js';

test('parseTranscriptScan reads gaps and the caller name from valid JSON', () => {
  const raw = JSON.stringify({
    gaps: [
      { topic: 'hours', question: 'Do you work weekends?' },
      { topic: 'service_area', question: 'Do you come out to Powhatan?' },
    ],
    caller_name: 'Dana',
  });
  const result = parseTranscriptScan(raw);
  assert.equal(result.gaps.length, 2);
  assert.equal(result.gaps[0].topic, 'hours');
  assert.equal(result.gaps[1].question, 'Do you come out to Powhatan?');
  assert.equal(result.callerName, 'Dana');
});

test('parseTranscriptScan normalizes an unrecognized topic to other', () => {
  const raw = JSON.stringify({ gaps: [{ topic: 'spaceships', question: 'Do you do spaceships?' }], caller_name: null });
  assert.equal(parseTranscriptScan(raw).gaps[0].topic, 'other');
});

test('parseTranscriptScan returns no gaps for a clean call', () => {
  const raw = JSON.stringify({ gaps: [], caller_name: 'Mike' });
  const result = parseTranscriptScan(raw);
  assert.deepEqual(result.gaps, []);
  assert.equal(result.callerName, 'Mike');
});

test('parseTranscriptScan returns empty rather than throwing on malformed JSON', () => {
  const result = parseTranscriptScan('not json at all {{{');
  assert.deepEqual(result.gaps, []);
  assert.equal(result.callerName, null);
});

test('parseTranscriptScan tolerates a missing gaps array', () => {
  assert.deepEqual(parseTranscriptScan(JSON.stringify({ caller_name: 'X' })).gaps, []);
});

test('parseTranscriptScan drops entries with an empty question', () => {
  const raw = JSON.stringify({ gaps: [{ topic: 'pricing', question: '   ' }, { topic: 'hours', question: 'Open Sunday?' }] });
  const result = parseTranscriptScan(raw);
  assert.equal(result.gaps.length, 1);
  assert.equal(result.gaps[0].question, 'Open Sunday?');
});

test('parseTranscriptScan handles null and empty input', () => {
  assert.deepEqual(parseTranscriptScan(null).gaps, []);
  assert.deepEqual(parseTranscriptScan('').gaps, []);
});

test('buildTranscriptScanPrompt names the business and lists every valid topic', () => {
  const prompt = buildTranscriptScanPrompt('Acme Plumbing');
  assert.equal(prompt.includes('Acme Plumbing'), true);
  for (const topic of GAP_TOPICS) assert.equal(prompt.includes(topic), true);
});

test('the voice instruction tells the AI not to guess and to ask for a name', () => {
  const instruction = buildVoiceGapInstruction();
  assert.equal(/never guess|do not guess/i.test(instruction), true);
  assert.equal(/name/i.test(instruction), true);
});
