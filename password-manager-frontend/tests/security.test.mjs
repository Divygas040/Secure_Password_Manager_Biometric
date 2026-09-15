import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStrongPassword } from '../src/utils/passwordGenerator.ts';
import { apiFetch, api, ApiError } from '../src/lib/api.ts';

test('generator uses cryptographic randomness and selected character classes', () => {
  const previous=Math.random;
  Math.random=()=>{throw new Error('Insecure randomness used');};
  try {
    for (let i=0;i<50;i++) {
      const value=generateStrongPassword();
      assert.equal(value.length,16);
      for (const pattern of [/[A-Z]/,/[a-z]/,/[0-9]/,/[^A-Za-z0-9]/]) assert.match(value,pattern);
    }
    assert.throws(()=>generateStrongPassword({length:1}));
    assert.throws(()=>generateStrongPassword({length:129}));
    const value=generateStrongPassword({includeUppercase:false,includeLowercase:false,includeNumbers:false,includeSymbols:false});
    assert.match(value,/^[a-z0-9]{16}$/);
  } finally {Math.random=previous;}
});

test('API uses credentials and CSRF for mutations; never sends bearer tokens', async () => {
  process.env.NEXT_PUBLIC_API_URL='https://api.example.com';
  const previous=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url, options) => {
    calls.push({url,options});
    return Response.json(url.endsWith('/csrf/')?{csrfToken:'test-only-csrf'}:{message:'ok'});
  };
  try {
    await apiFetch('/api/users/login/',{method:'POST',body:JSON.stringify({email:'test@example.invalid',password:'fixture'})});
    assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('/csrf/'));
    assert.equal(calls[1].options.credentials,'include');assert.equal(calls[1].options.cache,'no-store');
    assert.equal(calls[1].options.headers.get('X-CSRFToken'),'test-only-csrf');
    assert.equal(calls[1].options.headers.has('Authorization'),false);
    await assert.rejects(()=>apiFetch('https://evil.example/api/users/'));
    globalThis.fetch=async()=>Response.json({detail:'Denied'},{status:403});
    await assert.rejects(()=>api('/api/users/me/'),ApiError);
  } finally {globalThis.fetch=previous;}
});
