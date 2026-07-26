// lib/voice-gap-scan.js
// After a voice call: read the transcript and record any question the AI
// could not properly answer.
//
// Runs on EVERY completed call, unconditionally — NOT gated on the assistant
// having collected a name. A caller who gets a fumbled answer and hangs up is
// exactly the invisible failure this feature exists to catch; a name makes an
// entry better, it never decides whether one exists.
// Spec: docs/superpowers/specs/2026-07-26-unanswered-questions-queue-design.md

import OpenAI from 'openai';
import { query } from './database.js';
import { buildTranscriptScanPrompt, parseTranscriptScan } from './knowledge-gaps.js';
import { recordGap, hasScannedCall } from './knowledge-gaps-store.js';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function processVoiceGapScan({ customerId, vapiCallId, callerPhone, transcript, existingContact }) {
  try {
    if (!openai || !customerId || !transcript || transcript.trim().length < 40) return;

    // Vapi can re-deliver an end-of-call webhook. Never scan a call twice —
    // it would duplicate rows and re-spend on the model.
    if (await hasScannedCall({ customerId, vapiCallId })) {
      console.log(`🧠 [GAPS] call ${vapiCallId} already scanned — skipping`);
      return;
    }

    const settingsResult = await query(
      `SELECT business_name FROM ai_channel_settings
       WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const businessName = settingsResult.rows[0]?.business_name || '';

    // ~40k chars covers a 45-minute call; at gpt-4o-mini rates the extra input
    // is negligible. Truncation is logged rather than silent — a feature that
    // exists to surface invisible failures must not have one of its own.
    const TRANSCRIPT_LIMIT = 40000;
    const fullTranscript = String(transcript);
    if (fullTranscript.length > TRANSCRIPT_LIMIT) {
      console.warn(`⚠️ [GAPS] call ${vapiCallId} transcript truncated for scan (${fullTranscript.length} chars) — gaps after this point are not seen`);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildTranscriptScanPrompt(businessName) },
        { role: 'user', content: fullTranscript.slice(0, TRANSCRIPT_LIMIT) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const { gaps, callerName } = parseTranscriptScan(completion.choices[0]?.message?.content || '');
    if (gaps.length === 0) {
      console.log(`🧠 [GAPS] call ${vapiCallId}: no gaps found`);
      return;
    }

    for (const gap of gaps) {
      await recordGap({
        customerId,
        topic: gap.topic,
        question: gap.question,
        channel: 'voice',
        contactId: existingContact?.id || null,
        contactPhone: callerPhone || null,
        contactName: callerName || existingContact?.name || null,
        vapiCallId,
      });
    }

    console.log(`🧠 [GAPS] call ${vapiCallId}: recorded ${gaps.length} gap(s)`);
  } catch (err) {
    console.error('⚠️ [GAPS] voice scan failed (call already handled, continuing):', err.message);
  }
}
