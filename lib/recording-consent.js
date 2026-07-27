// lib/recording-consent.js
// Decides whether an inbound call's recording may be KEPT without having
// announced it to the caller.
//
// BizzyBot's own end is Virginia, a one-party-consent state, so the governing
// question is where the CALLER is. Most US states are one-party (the business
// consenting is enough); a minority require every party to consent, which in
// practice means announcing the recording.
//
// Founder decision 2026-07-27: do not announce. Keep recordings only for
// callers whose area code places them in a one-party state.
//
// ⚠️ WHAT THIS DOES AND DOES NOT DO. Vapi records every call on its own
// servers (recordingEnabled in lib/vapi.js). This module only decides whether
// BizzyBot STORES and surfaces the recording URL. It does not stop the
// recording from being made. Fully suppressing capture per-call requires the
// Vapi assistant-request webhook, which does not exist yet.
//
// ⚠️ AREA CODE IS A PROXY, NOT A LOCATION. Mobile numbers keep their area code
// when people move. A 415 number in Texas reads as California here. That is
// why every uncertain case fails CLOSED (no recording kept) rather than open.
//
// Not legal advice. Recording law is state-specific and changes; this list is
// a considered starting point, not a substitute for counsel.

/**
 * Area codes in states that require all parties to consent to recording.
 * CA, CT, DE, FL, IL, MD, MA, MI, MT, NV, NH, OR, PA, WA.
 *
 * MAINTENANCE: new area codes are assigned periodically. One added to a state
 * on this list and not added here would be treated as one-party and recorded.
 * Worth a re-check yearly.
 */
export const ALL_PARTY_AREA_CODES = new Set([
  // California
  '209','213','279','310','323','341','350','408','415','424','442','510','530',
  '559','562','619','626','628','650','657','661','669','707','714','747','760',
  '805','818','820','831','840','858','909','916','925','949','951',
  // Connecticut
  '203','475','860','959',
  // Delaware
  '302',
  // Florida
  '239','305','321','352','386','407','448','561','656','689','727','754','772',
  '786','813','850','863','904','941','954',
  // Illinois
  '217','224','309','312','331','447','464','618','630','708','730','773','779',
  '815','847','872',
  // Maryland
  '227','240','301','410','443','667',
  // Massachusetts
  '339','351','413','508','617','774','781','857','978',
  // Michigan
  '231','248','269','313','517','586','616','679','734','810','906','947','989',
  // Montana
  '406',
  // Nevada
  '702','725','775',
  // New Hampshire
  '603',
  // Oregon
  '458','503','541','971',
  // Pennsylvania
  '215','223','267','272','412','445','484','570','582','610','717','724','814',
  '835','878',
  // Washington
  '206','253','360','425','509','564',
]);

/**
 * Toll-free and non-geographic codes carry no location information at all,
 * so they can never establish that a caller is in a one-party state.
 */
export const NON_GEOGRAPHIC_AREA_CODES = new Set([
  '800','833','844','855','866','877','888', // toll-free
  '900','976', // premium
  '911','988', // service
]);

/** Extract the 3-digit NANP area code from a phone number, or null. */
export function areaCodeOf(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;

  // +1XXXXXXXXXX (11 digits, US country code) or XXXXXXXXXX (10 digits).
  let national;
  if (digits.length === 11 && digits.startsWith('1')) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  else return null; // too short, too long, or not a NANP number

  const area = national.slice(0, 3);
  // Valid NANP area codes never start with 0 or 1.
  if (area[0] === '0' || area[0] === '1') return null;
  return area;
}

/**
 * May this call's recording be kept without having announced it?
 *
 * FAILS CLOSED. Returns true ONLY when the caller's area code places them in a
 * state where one party's consent is enough. Missing number, non-US number,
 * toll-free, withheld caller ID, malformed input — all return false, because
 * the cost of wrongly keeping a recording is legal and the cost of wrongly
 * discarding one is a missing audio file.
 */
export function mayKeepRecording(callerPhone) {
  const area = areaCodeOf(callerPhone);
  if (!area) return false;
  if (NON_GEOGRAPHIC_AREA_CODES.has(area)) return false;
  if (ALL_PARTY_AREA_CODES.has(area)) return false;
  return true;
}
