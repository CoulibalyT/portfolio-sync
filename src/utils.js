const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function saveScreenshot(outputDir, filename, buffer) {
  const fullPath = path.join(outputDir, filename);
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasFileChanged(filePath, newBuffer) {
  try {
    await fs.access(filePath);
  } catch {
    return true; // File doesn't exist, so it's "changed"
  }

  const existingBuffer = await fs.readFile(filePath);
  const existingHash = crypto.createHash('md5').update(existingBuffer).digest('hex');
  const newHash = crypto.createHash('md5').update(newBuffer).digest('hex');

  return existingHash !== newHash;
}

module.exports = {
  ensureDir,
  saveScreenshot,
  fileExists,
  hasFileChanged
};
