import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { startEnrollment, advanceEnrollment, validateCurrentPassword, runPasswordConfirmation, NO_FACE_MESSAGE } from '../src/lib/enrollment.ts';

test('current password accepts existing weak strings without trimming and caps length', () => {
  for (const value of ['x', '  existing  ', 'x'.repeat(128)]) assert.equal(validateCurrentPassword(value), undefined);
  for (const value of ['', 'x'.repeat(129)]) assert.ok(validateCurrentPassword(value));
});

test('first enrollment requires successful password confirmation before capture', () => {
  const step = startEnrollment(false);
  assert.equal(step, 'confirm-password');
  assert.equal(advanceEnrollment(step, 'face-verified'), step);
  assert.equal(advanceEnrollment(step, 'password-confirmed'), 'capture');
  assert.equal(advanceEnrollment('capture', 'completed'), 'closed');
  assert.equal(advanceEnrollment(step, 'cancelled'), 'closed');
  assert.equal(advanceEnrollment('closed', 'password-confirmed'), 'closed');
});

test('replacement requires current-face success; password confirmation cannot advance it', () => {
  const step = startEnrollment(true);
  assert.equal(step, 'verify-current-face');
  assert.equal(advanceEnrollment(step, 'password-confirmed'), step);
  assert.equal(advanceEnrollment(step, 'face-verified'), 'capture');
  assert.equal(advanceEnrollment('capture', 'completed'), 'closed');
});

test('confirmation clears transient password on success and rejects duplicate in-flight posts', async () => {
  let value = '  exact existing password  ';
  const pending = { current: false };
  let complete;
  let calls = 0;
  const send = async password => { calls++; assert.equal(password, value); await new Promise(resolve => { complete = resolve; }); };
  const first = runPasswordConfirmation(value, pending, send, () => { value = ''; });
  assert.equal(pending.current, true);
  assert.equal(await runPasswordConfirmation(value, pending, send, () => { value = ''; }), false);
  assert.equal(calls, 1);
  complete();
  assert.equal(await first, true);
  assert.equal(value, '');
  assert.deepEqual(pending, { current: false });
});

test('confirmation clears transient password even on failed or rejected requests', async () => {
  let value = 'temporary fixture';
  const pending = { current: false };
  await assert.rejects(runPasswordConfirmation(value, pending, async () => { throw new Error('Denied'); }, () => { value = ''; }));
  assert.equal(value, '');
  assert.equal(pending.current, false);
});

test('vault without a face provides setup guidance and all unlock loads call the API', () => {
  assert.equal(NO_FACE_MESSAGE, 'Set up face verification before unlocking your vault.');
  const source = readFileSync(new URL('../src/app/password/show/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /NO_FACE_MESSAGE/);
  assert.match(source, /href="\/dashboard">Set up face verification/);
  assert.match(source, /api<Credential\[\]>\('\/api\/users\/passwords\/'\)/);
});

test('dashboard wires both authorization steps; confirmation has no persistent credential storage', () => {
  const dashboard = readFileSync(new URL('../src/app/dashboard/page.tsx', import.meta.url), 'utf8');
  const confirmation = readFileSync(new URL('../src/components/PasswordConfirmation.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /step === 'confirm-password'.*<PasswordConfirmation/);
  assert.match(dashboard, /step === 'verify-current-face'.*<FaceVerification/);
  assert.match(dashboard, /step === 'capture'.*<FaceVerification enroll/);
  assert.match(confirmation, /runPasswordConfirmation/);
  assert.match(confirmation, /\(\) => setPassword\(''\)/);
  assert.match(confirmation, /if \(pending.current\) return/);
  assert.match(confirmation, /autoComplete="current-password"/);
  assert.doesNotMatch(confirmation, /localStorage|sessionStorage|\.trim\(/);
  // The removed delivery component is checked without retaining its old UI label.
  assert.equal(existsSync(new URL('../src/components/OTPAuth.tsx', import.meta.url)), false);
});
