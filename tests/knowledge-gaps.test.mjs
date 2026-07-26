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
  ];
  for (const n of nasties) {
    assert.equal(stripGapMarkers(`Hello ${n}`).includes('UNKNOWN'), false, `leaked: ${n}`);
  }
});
