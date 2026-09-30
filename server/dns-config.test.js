import test from 'node:test';
import assert from 'node:assert/strict';

import { checkConflict, validateAddName, validateContent } from '../src/components/dns/dnsConfig.js';

test('validateAddName accepts root, relative, and pasted fully-qualified names', () => {
  assert.deepEqual(validateAddName('@', 'example.open-domains.com'), {
    valid: true,
    isRoot: true,
    label: '',
    full: 'example.open-domains.com',
    error: null,
  });

  assert.deepEqual(validateAddName('www', 'example.open-domains.com'), {
    valid: true,
    isRoot: false,
    label: 'www',
    full: 'www.example.open-domains.com',
    error: null,
  });

  assert.deepEqual(validateAddName('WWW.Example.Open-Domains.Com.', 'example.open-domains.com'), {
    valid: true,
    isRoot: false,
    label: 'www',
    full: 'www.example.open-domains.com',
    error: null,
  });
});

test('validateContent validates supporter NS records before submit', () => {
  assert.equal(validateContent('NS', 'ns1.example.net').valid, true);
  assert.equal(validateContent('NS', 'not a host').valid, false);
});

test('checkConflict catches CNAME coexistence and permits distinct A records', () => {
  const existing = [
    { id: 'a', name: 'www.example.open-domains.com', record_type: 'A', content: '203.0.113.10' },
  ];

  assert.equal(checkConflict('www.example.open-domains.com', 'CNAME', 'target.example.com', existing).conflict, true);
  assert.equal(checkConflict('www.example.open-domains.com', 'A', '203.0.113.11', existing).conflict, false);
  assert.equal(checkConflict('www.example.open-domains.com', 'A', '203.0.113.10', existing).conflict, true);
});
