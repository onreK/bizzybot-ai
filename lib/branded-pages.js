import { query } from './database.js';
import { ensureVerificationInfoTable } from './tollfree-verification.js';

// Look up the customer that owns a toll-free number, for the public
// branded opt-in / SMS-terms pages. numberParam is the URL segment —
// accepts 10 digits, 11 digits with leading 1, or anything containing them.
export async function getBrandedPageData(numberParam) {
  const digits = String(numberParam || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (digits.length !== 10) return null;

  // Make sure optional columns exist before selecting them (safe/idempotent —
  // legal_business_name may predate its onboarding-form rollout).
  await ensureVerificationInfoTable().catch(() => {});

  const result = await query(
    `SELECT cpn.phone_number,
            c.business_name,
            bp.website,
            svi.legal_business_name,
            svi.business_email
     FROM customer_phone_numbers cpn
     JOIN customers c ON c.clerk_user_id = cpn.clerk_user_id
     LEFT JOIN business_profiles bp ON bp.customer_id = c.id
     LEFT JOIN sms_verification_info svi ON svi.clerk_user_id = cpn.clerk_user_id
     WHERE regexp_replace(cpn.phone_number, '\\D', '', 'g') IN ($1, '1' || $1)
     ORDER BY (bp.website IS NOT NULL AND bp.website <> '') DESC
     LIMIT 1`,
    [digits]
  ).catch(() => ({ rows: [] }));

  const row = result.rows[0];
  if (!row) return null;

  const brand = (row.business_name || '').trim() || (row.legal_business_name || '').trim();
  const legalName = (row.legal_business_name || '').trim() || brand;
  if (!brand) return null;

  const website = (row.website || '').trim();
  const websiteDomain = website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

  return {
    brand,
    legalName,
    phoneDigits: digits,
    formattedNumber: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
    website,
    websiteDomain,
    businessEmail: (row.business_email || '').trim(),
  };
}
