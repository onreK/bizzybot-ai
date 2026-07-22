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

test('the comp/demo account (863) always has access, even with no sub and an old signup', () => {
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
  // id can arrive as a number or a string from the DB driver — both must match.
  assert.equal(hasActiveAccess({ id: 863, stripe_subscription_id: null, created_at: twentyDaysAgo }), true);
  assert.equal(hasActiveAccess({ id: '863', stripe_subscription_id: null, created_at: twentyDaysAgo }), true);
});

test('a non-comp expired account is still cut off (comp check does not leak)', () => {
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(hasActiveAccess({ id: 999, stripe_subscription_id: null, created_at: twentyDaysAgo }), false);
});
