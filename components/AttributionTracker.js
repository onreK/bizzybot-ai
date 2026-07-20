'use client';

import { useEffect } from 'react';
import { captureAttributionOnLoad } from '@/lib/attribution-client.js';

// Renders nothing — just captures first-touch attribution (UTM params, ?ref=,
// or an external referrer) into a cookie once per visitor. See lib/attribution-client.js.
export default function AttributionTracker() {
  useEffect(() => {
    captureAttributionOnLoad();
  }, []);
  return null;
}
