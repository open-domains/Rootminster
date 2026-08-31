import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSetupInput } from './setup.js';

test('setup requires a valid first name, email, and strong password', () => {
  assert.equal(validateSetupInput({}).error, 'Enter a first name of 80 characters or fewer');
  assert.equal(validateSetupInput({ firstName: 'Andy', email: 'nope', password: 'long-enough-password' }).error, 'Enter a valid email address');
  assert.equal(validateSetupInput({ firstName: 'Andy', email: 'andy@example.com', password: 'short' }).error, 'Password must be at least 12 characters');
});

test('setup normalises valid account details', () => {
  assert.deepEqual(validateSetupInput({ firstName: ' Andy ', email: ' ANDY@EXAMPLE.COM ', password: 'long-enough-password' }), {
    firstName: 'Andy', email: 'andy@example.com', password: 'long-enough-password',
  });
});
