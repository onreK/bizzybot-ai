import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOT_LEAD_KEYWORDS, KEYWORD_SCORE_CAP, scoreKeywordMatches } from '../lib/hot-lead-keywords.js';

test('everyday support words are no longer hot-lead keywords', () => {
  const banned = ['help', 'issue', 'problem', 'contact', 'call me', 'phone', 'broken', 'not working', 'money'];
  for (const word of banned) {
    assert.ok(!HOT_LEAD_KEYWORDS.includes(word), `"${word}" should not be a hot-lead keyword`);
  }
});

test('a support-style email scores zero from keywords', () => {
  const { score } = scoreKeywordMatches('I need help with a problem, please contact me about this issue');
  assert.equal(score, 0);
});

test('keyword score is capped below the hot threshold (60)', () => {
  // every keyword in the list at once still cannot clear 60
  const everything = HOT_LEAD_KEYWORDS.join(' ');
  const { score } = scoreKeywordMatches(everything);
  assert.equal(score, KEYWORD_SCORE_CAP);
  assert.ok(KEYWORD_SCORE_CAP < 60);
});

test('real buying signals still register', () => {
  const { matches, score } = scoreKeywordMatches('what is your price? my budget is ready');
  assert.ok(matches.includes('price'));
  assert.ok(matches.includes('budget'));
  assert.equal(score, 30);
});

test('custom customer keywords still count', () => {
  const { matches } = scoreKeywordMatches('interested in solar panels', ['solar panels']);
  assert.ok(matches.includes('solar panels'));
});
