const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { resolveEnvVar } = require('../src/auth');

describe('resolveEnvVar', () => {
  beforeEach(() => {
    process.env.TEST_VAR = 'test-value';
  });

  afterEach(() => {
    delete process.env.TEST_VAR;
  });

  it('should resolve ${VAR} format', () => {
    assert.equal(resolveEnvVar('${TEST_VAR}'), 'test-value');
  });

  it('should resolve $VAR format', () => {
    assert.equal(resolveEnvVar('$TEST_VAR'), 'test-value');
  });

  it('should return a normal string as-is', () => {
    assert.equal(resolveEnvVar('hello'), 'hello');
  });

  it('should throw on missing env variable (${} format)', () => {
    assert.throws(
      () => resolveEnvVar('${MISSING_VAR_XYZ}'),
      { message: /MISSING_VAR_XYZ is not defined/ }
    );
  });

  it('should throw on missing env variable ($ format)', () => {
    assert.throws(
      () => resolveEnvVar('$MISSING_VAR_XYZ'),
      { message: /MISSING_VAR_XYZ is not defined/ }
    );
  });

  it('should return non-string values as-is', () => {
    assert.equal(resolveEnvVar(42), 42);
    assert.equal(resolveEnvVar(null), null);
  });
});
