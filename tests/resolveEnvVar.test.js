const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { resolveEnvVar, resolveEnvVarsInString } = require('../src/auth');

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

describe('resolveEnvVarsInString', () => {
  beforeEach(() => {
    process.env.FOO = 'foo-value';
    process.env.BAR = 'bar-value';
  });

  afterEach(() => {
    delete process.env.FOO;
    delete process.env.BAR;
  });

  it('should substitute a single ${VAR} inline', () => {
    assert.equal(
      resolveEnvVarsInString('prefix-${FOO}-suffix'),
      'prefix-foo-value-suffix'
    );
  });

  it('should substitute multiple ${VAR} occurrences', () => {
    assert.equal(
      resolveEnvVarsInString('${FOO} and ${BAR} and ${FOO}'),
      'foo-value and bar-value and foo-value'
    );
  });

  it('should leave a string with no ${VAR} untouched', () => {
    assert.equal(resolveEnvVarsInString('no vars here'), 'no vars here');
  });

  it('should throw on missing env variable', () => {
    assert.throws(
      () => resolveEnvVarsInString('before-${MISSING_VAR_XYZ}-after'),
      { message: /MISSING_VAR_XYZ is not defined/ }
    );
  });

  it('should return non-string values as-is', () => {
    assert.equal(resolveEnvVarsInString(null), null);
    assert.equal(resolveEnvVarsInString(42), 42);
  });
});
