const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig } = require('../src/config');

function validConfig() {
  return {
    projects: [
      {
        name: 'test-project',
        url: 'https://example.com',
        pages: [{ path: '/', name: 'home' }],
        outputDir: './output'
      }
    ]
  };
}

describe('validateConfig', () => {
  it('should accept a valid config', () => {
    assert.doesNotThrow(() => validateConfig(validConfig()));
  });

  it('should throw if projects is missing', () => {
    assert.throws(
      () => validateConfig({}),
      { message: /non-empty "projects" array/ }
    );
  });

  it('should throw if projects is empty', () => {
    assert.throws(
      () => validateConfig({ projects: [] }),
      { message: /non-empty "projects" array/ }
    );
  });

  it('should throw if a project is missing url', () => {
    const config = validConfig();
    delete config.projects[0].url;
    assert.throws(
      () => validateConfig(config),
      { message: /missing required field 'url'/ }
    );
  });

  it('should throw if a project is missing name', () => {
    const config = validConfig();
    delete config.projects[0].name;
    assert.throws(
      () => validateConfig(config),
      { message: /missing required field 'name'/ }
    );
  });

  it('should throw if pages is empty', () => {
    const config = validConfig();
    config.projects[0].pages = [];
    assert.throws(
      () => validateConfig(config),
      { message: /non-empty array/ }
    );
  });

  it('should throw if a page is missing name', () => {
    const config = validConfig();
    config.projects[0].pages = [{ path: '/' }];
    assert.throws(
      () => validateConfig(config),
      { message: /must have a 'name' field/ }
    );
  });

  it('should throw on unsupported auth type', () => {
    const config = validConfig();
    config.projects[0].auth = { type: 'oauth' };
    assert.throws(
      () => validateConfig(config),
      { message: /unsupported auth type 'oauth'/ }
    );
  });

  it('should accept valid auth types', () => {
    const config = validConfig();
    config.projects[0].auth = { type: 'form' };
    assert.doesNotThrow(() => validateConfig(config));
  });
});
