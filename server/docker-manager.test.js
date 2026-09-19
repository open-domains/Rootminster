import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalProjectName, isProtectedDockerProject } from './docker-manager.js';

test('canonicalProjectName normalises separators and case', () => {
  assert.equal(canonicalProjectName('Open-Domains_V2'), 'opendomainsv2');
});

test('built-in platform project names can never be managed', () => {
  for (const name of ['opendomains', 'open-domains-production', 'Rootminster', 'rootminster-v2']) {
    assert.equal(isProtectedDockerProject({ name }), true, name);
  }
});

test('platform containers protect a generically named compose project', () => {
  const project = {
    name: 'production',
    containers: [{ name: 'web', image: 'ghcr.io/open-domains/rootminster:latest' }],
  };
  assert.equal(isProtectedDockerProject(project), true);
});

test('additional protected projects are exact matches after normalisation', () => {
  const settings = { protected_projects: 'traefik, monitoring-stack' };
  assert.equal(isProtectedDockerProject({ name: 'monitoring_stack' }, settings), true);
  assert.equal(isProtectedDockerProject({ name: 'customer-monitoring-stack' }, settings), false);
});

test('ordinary projects remain manageable', () => {
  assert.equal(isProtectedDockerProject({ name: 'customer-site', containers: [{ image: 'nginx:latest' }] }), false);
});
