import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSignup, validateLogin, validateVault, normalizeEmail, normalizeOTP, validOTP, validateFaceImage, USERNAME_PATTERN } from '../src/lib/validation.ts';
import { formatApiError, formError, ApiError, api } from '../src/lib/api.ts';
const signup = { username: 'TestUser', phone: '1234567890', email: 'test@example.com', password: 'Strong-fixture!42', terms: true };

test('signup username, phone, email and password boundaries', () => {
  for (const username of ['ab', 'a'.repeat(31), 'Full Name', 'a/b', 'Ｔｅｓｔ']) assert.ok(validateSignup({ ...signup, username }).username);
  for (const username of ['abc', 'a'.repeat(30), '  User@.+-_42  ']) assert.equal(validateSignup({ ...signup, username }).username, undefined);
  assert.ok(new RegExp(`^(?:${USERNAME_PATTERN})$`, 'v').test('User@.+-_42'));
  for (const phone of ['1'.repeat(9), '1'.repeat(16), '+1234567890', '123 4567890', '１２３４５６７８９０']) assert.ok(validateSignup({ ...signup, phone }).phone);
  for (const phone of ['1'.repeat(10), '1'.repeat(15)]) assert.equal(validateSignup({ ...signup, phone }).phone, undefined);
  for (const email of ['', 'bad', 'a@@example.com', 'a..b@example.com', 'a@example..com', 'a@-example.com', 'a@example.c', 'a'.repeat(250) + '@x.com']) assert.ok(validateSignup({ ...signup, email }).email);
  assert.equal(normalizeEmail(' TEST@EXAMPLE.COM '), 'test@example.com');
  assert.equal(validateSignup({ ...signup, email: ' TEST@EXAMPLE.COM ' }).email, undefined);
  for (const password of ['', 'x'.repeat(11), 'x'.repeat(129)]) assert.ok(validateSignup({ ...signup, password }).password);
  for (const password of ['x'.repeat(12), 'x'.repeat(128)]) assert.equal(validateSignup({ ...signup, password }).password, undefined);
  assert.ok(validateSignup({ ...signup, terms: false }).terms);
});

test('login permits existing weak passwords but enforces required and maximum', () => {
  for (const password of ['x', '  x  ', 'x'.repeat(128)]) assert.deepEqual(validateLogin({ email: signup.email, password }), {});
  for (const password of ['', 'x'.repeat(129)]) assert.ok(validateLogin({ email: signup.email, password }).password);
  assert.ok(validateLogin({ email: '', password: 'x' }).email);
});

test('vault preserves existing passwords and permits legitimate display names', () => {
  const values = { domain_name: ' École / Work & Home 🔒 ', password: ' weak ', link: '' };
  assert.deepEqual(validateVault(values), {});
  assert.equal(values.password, ' weak ');
  for (const domain_name of ['', '  ', '\u200b\u200d', '\x01\x02', 'x'.repeat(256)]) assert.ok(validateVault({ ...values, domain_name }).domain_name);
  assert.equal(validateVault({ ...values, domain_name: 'x'.repeat(255) }).domain_name, undefined);
  for (const password of [' ', 'x', 'x'.repeat(4096)]) assert.equal(validateVault({ ...values, password }).password, undefined);
  for (const password of ['', 'x'.repeat(4097)]) assert.ok(validateVault({ ...values, password }).password);
  for (const link of ['', ' https://example.com/path ', 'http://example.com']) assert.equal(validateVault({ ...values, link }).link, undefined);
  for (const link of ['ftp://example.com', 'javascript:alert(1)', 'https://', 'https:example.com', 'not a URL', 'https://example.com/' + 'x'.repeat(201)]) assert.ok(validateVault({ ...values, link }).link);
});

test('OTP accepts six ASCII digits only and normalizes paste', () => {
  assert.equal(normalizeOTP('a12-34 56７89'), '123456');
  assert.equal(validOTP('123456'), true);
  for (const value of ['', '12345', '1234567', '１２３４５６', '123456\n']) assert.equal(validOTP(value), false);
});

test('face capture rejects unsupported MIME types, empty and oversized files', () => {
  assert.equal(validateFaceImage(new Blob(['fixture'], { type: 'image/jpeg' })), undefined);
  assert.equal(validateFaceImage(new Blob(['fixture'], { type: 'image/png' })), undefined);
  assert.ok(validateFaceImage(new Blob([], { type: 'image/jpeg' })));
  assert.ok(validateFaceImage(new Blob(['fixture'], { type: 'image/svg+xml' })));
  assert.ok(validateFaceImage(new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/jpeg' })));
});

test('DRF formatter separates field errors and form-level errors', () => {
  const result = formatApiError({ username: ['No spaces.'], phone: ['10–15 digits.'], password: ['Too common.', 'Too short.'] }, 400);
  assert.deepEqual(result.fields, { username: 'No spaces.', phone: '10–15 digits.', password: 'Too common. Too short.' });
  assert.equal(result.hasFormMessage, false);
  const error = new ApiError(result.message, 400, result.fields, undefined, result.hasFormMessage);
  assert.equal(formError(error, ['username', 'phone', 'password']).message, '');
  assert.equal(formatApiError({ detail: 'Invalid credentials.' }, 401).message, 'Invalid credentials.');
  assert.equal(formatApiError({ non_field_errors: ['Unable to register.'] }, 400).message, 'Unable to register.');
  assert.equal(formatApiError(['Exactly one clear face is required.'], 400).message, 'Exactly one clear face is required.');
});

test('formatter suppresses HTML, debug pages, provider details and network internals', () => {
  for (const data of [{ detail: '<script>alert(1)</script>' }, { detail: 'Traceback private path' }, { detail: 'x'.repeat(501) }]) assert.equal(formatApiError(data, 400).message, 'The request could not be completed.');
  assert.equal(formatApiError({ detail: 'private-provider-details', password: ['private'] }, 500).message, 'The request could not be completed.');
  assert.deepEqual(formatApiError({ password: ['private'] }, 500).fields, {});
  assert.equal(formError(new Error('private network details'), []).message, 'Unable to connect. Please try again.');
});

test('429 preserves remaining wait from headers or response including HTTP dates', () => {
  assert.equal(formatApiError({ detail: 'Wait.' }, 429, '13').retryAfter, 13);
  assert.match(formatApiError({ detail: 'Wait.' }, 429, '13').message, /13 seconds/);
  assert.equal(formatApiError({ retry_after: 15 }, 429).retryAfter, 15);
  const wait = formatApiError({}, 429, new Date(Date.now() + 30_000).toUTCString()).retryAfter;
  assert.ok(wait >= 29 && wait <= 30);
  assert.equal(formatApiError({}, 429, 'nonsense').retryAfter, undefined);
});

test('API propagates field errors and Retry-After to forms', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ detail: 'Wait.' }, { status: 429, headers: { 'Retry-After': '17' } });
    await assert.rejects(() => api('/api/users/me/'), error => error instanceof ApiError && error.retryAfter === 17);
    globalThis.fetch = async () => Response.json({ username: ['Invalid username.'] }, { status: 400 });
    await assert.rejects(() => api('/api/users/me/'), error => error.fields.username === 'Invalid username.' && !error.hasFormMessage);
  } finally { globalThis.fetch = previous; }
});
