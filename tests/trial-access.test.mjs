import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasActiveAccess } from '../lib/trial-access.js';

test('a customer with a real Stripe subscription always has access', () => {
  const customer = { stripe_subscription_id: 'sub_123', created_at: '2020-01-01T00:00:00Z' };
  assert.equal(hasActiveAccess(customer), true);
});

test('a customer within their 14-day trial (no subscription yet) has access', () => {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const customer = { stripe_subscription_id: null, created_at: twoDaysAgo };
  assert.equal(hasActiveAccess(customer), true);
});

test('a customer whose 14-day trial has fully passed, with no subscription, has no access', () => {
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const customer = { stripe_subscription_id: null, created_at: twentyDaysAgo };
  assert.equal(hasActiveAccess(customer), false);
});

test('exactly at the 14-day boundary still has no access (trial has ended, not "ending today")', () => {
  const exactlyFourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 - 1000).toISOString();
  const customer = { stripe_subscription_id: null, created_at: exactlyFourteenDaysAgo };
  assert.equal(hasActiveAccess(customer), false);
});

test('no customer record at all has no access', () => {
  assert.equal(hasActiveAccess(null), false);
  assert.equal(hasActiveAccess(undefined), false);
});
