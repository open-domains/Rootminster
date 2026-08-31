import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyDiscordSignature } from './discord.js';

test('Discord interaction signatures are verified with Ed25519', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicHex = publicDer.subarray(-32).toString('hex');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: 1 });
  const signature = crypto.sign(null, Buffer.from(`${timestamp}${body}`), privateKey).toString('hex');

  assert.equal(verifyDiscordSignature(body, timestamp, signature, publicHex), true);
  assert.equal(verifyDiscordSignature(`${body} `, timestamp, signature, publicHex), false);
  assert.equal(verifyDiscordSignature(body, timestamp, 'not-a-signature', publicHex), false);
  const staleTimestamp = String(Number(timestamp) - 301);
  const staleSignature = crypto.sign(null, Buffer.from(`${staleTimestamp}${body}`), privateKey).toString('hex');
  assert.equal(verifyDiscordSignature(body, staleTimestamp, staleSignature, publicHex), false);
});
