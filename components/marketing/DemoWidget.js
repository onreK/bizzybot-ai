import Script from 'next/script';

/**
 * BizzyBot's own chat widget, on BizzyBot's own marketing pages — the platform
 * demoing itself, which is the stated purpose of the 863 demo account.
 *
 * A prospect who asks it a question is simultaneously seeing the product work
 * and becoming a lead in the dashboard; anything it can't answer lands in the
 * unanswered-questions queue, which is unusually direct feedback on our own
 * marketing copy.
 *
 * ⚠️ DEMO_WIDGET_ID is a Clerk user id. The Clerk instance was migrated once
 * already (2026-07-20, Development → Production) and every id changed that
 * day. If it is ever migrated again this widget goes quiet with no error and
 * nothing in the UI will say so — update it here, in this one place.
 *
 * Not a secret: the id already appears in the public widget script URL of
 * every customer who embeds the widget on their own site.
 */
export const DEMO_WIDGET_ID = 'user_3Gle14qY1sQNmNCfVf4cOo4DiU1';

export default function DemoWidget() {
  return (
    <Script
      src={`/api/widget/${DEMO_WIDGET_ID}/widget.js`}
      strategy="lazyOnload"
    />
  );
}
