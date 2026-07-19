#!/usr/bin/env node
// Eval gate for the email intent-triage classifier.
// Usage: node scripts/triage-eval.mjs
// Requires OPENAI_API_KEY (reads .env.local if present).
// Pass criteria (spec): business_correspondence recall 100% on this set,
// ZERO business_correspondence classified as a high-confidence lead,
// overall accuracy >= 90%. Exit 0 on pass, 1 on fail.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env.local loader (no dotenv dependency in this project)
const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set (checked env + .env.local). Cannot run eval.');
  process.exit(1);
}

const { classifyEmailIntent } = await import('../lib/intent-triage.js');

const { business, emails } = JSON.parse(readFileSync(join(root, 'scripts', 'triage-eval-set.json'), 'utf8'));

const results = [];
for (const email of emails) {
  const signals = {
    subject: email.subject,
    body: email.body,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    isReplyToOurThread: false,
    isExistingContact: false,
    contactSummary: '',
    corrections: [],
    ...business,
    ...(email.signals || {}),
  };
  const got = await classifyEmailIntent(signals);
  const correct = got.class === email.label;
  results.push({ id: email.id, expected: email.label, got: got.class, confidence: got.confidence, model: got.model, correct, reason: got.reason });
  console.log(`${correct ? '✅' : '❌'} ${email.id}: expected ${email.label}, got ${got.class}/${got.confidence} [${got.model}] — ${got.reason}`);
}

// ── Report ──────────────────────────────────────────────────────────────────
const classes = ['new_lead', 'existing_lead_reply', 'business_correspondence', 'automated', 'ambiguous'];
console.log('\nPer-class accuracy:');
for (const cls of classes) {
  const ofClass = results.filter(r => r.expected === cls);
  if (ofClass.length === 0) continue;
  const right = ofClass.filter(r => r.correct).length;
  console.log(`  ${cls}: ${right}/${ofClass.length} (${Math.round((right / ofClass.length) * 100)}%)`);
}

const overall = results.filter(r => r.correct).length / results.length;
console.log(`\nOverall: ${results.filter(r => r.correct).length}/${results.length} (${Math.round(overall * 100)}%)`);

const bc = results.filter(r => r.expected === 'business_correspondence');
const bcMisses = bc.filter(r => !r.correct);
const bcAsHighLead = bc.filter(r =>
  ['new_lead', 'existing_lead_reply'].includes(r.got) && r.confidence === 'high'
);

console.log('\nGate checks:');
console.log(`  business_correspondence recall 100%: ${bcMisses.length === 0 ? 'PASS' : `FAIL (missed: ${bcMisses.map(r => r.id).join(', ')})`}`);
console.log(`  zero bc → high-confidence lead:      ${bcAsHighLead.length === 0 ? 'PASS' : `FAIL (${bcAsHighLead.map(r => r.id).join(', ')})`}`);
console.log(`  overall >= 90%:                      ${overall >= 0.9 ? 'PASS' : 'FAIL'}`);

const pass = bcMisses.length === 0 && bcAsHighLead.length === 0 && overall >= 0.9;
console.log(`\n${pass ? '🟢 EVAL PASSED — classifier may gate real traffic.' : '🔴 EVAL FAILED — do NOT wire the classifier to live email.'}`);
process.exit(pass ? 0 : 1);
