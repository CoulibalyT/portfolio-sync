const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { optimizeImage } = require('../src/optimizer');
const sharp = require('sharp');

// Create a small test image buffer
async function createTestImage() {
  return sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();
}

describe('optimizeImage', () => {
  it('should return a buffer', async () => {
    const input = await createTestImage();
    const result = await optimizeImage(input, { format: 'webp', quality: 80 });
    assert.ok(Buffer.isBuffer(result));
    assert.ok(result.length > 0);
  });

  it('should produce webp output', async () => {
    const input = await createTestImage();
    const result = await optimizeImage(input, { format: 'webp' });
    assert.ok(Buffer.isBuffer(result));
  });

  it('should produce jpeg output', async () => {
    const input = await createTestImage();
    const result = await optimizeImage(input, { format: 'jpeg' });
    assert.ok(Buffer.isBuffer(result));
  });

  it('should produce png output', async () => {
    const input = await createTestImage();
    const result = await optimizeImage(input, { format: 'png' });
    assert.ok(Buffer.isBuffer(result));
  });

  it('should throw on unsupported format', async () => {
    const input = await createTestImage();
    await assert.rejects(
      () => optimizeImage(input, { format: 'bmp' }),
      { message: /Unsupported format: bmp/ }
    );
  });

  it('should resize when maxWidth is set', async () => {
    const input = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } }
    }).png().toBuffer();

    const result = await optimizeImage(input, { format: 'png', maxWidth: 50 });
    const metadata = await sharp(result).metadata();
    assert.equal(metadata.width, 50);
  });
});
