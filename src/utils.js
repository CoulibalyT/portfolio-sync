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

/**
 * Sauvegarde l'état de la page (screenshot, DOM, URL, erreur) pour diagnostic.
 * Appelé quand une capture échoue en mode --debug.
 */
async function dumpDebugArtifacts(page, debugDir, name, error) {
  await ensureDir(debugDir);
  const base = path.join(debugDir, name);

  try {
    const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
    await fs.writeFile(`${base}.png`, screenshot);
  } catch (_) { /* best-effort */ }

  try {
    const html = await page.content();
    await fs.writeFile(`${base}.html`, html);
  } catch (_) { /* best-effort */ }

  const log = [
    `Time: ${new Date().toISOString()}`,
    `URL: ${page.url()}`,
    `Error: ${error && error.message ? error.message : String(error)}`,
    error && error.stack ? `Stack:\n${error.stack}` : ''
  ].filter(Boolean).join('\n');
  await fs.writeFile(`${base}.log`, log);

  return base;
}

module.exports = {
  ensureDir,
  saveScreenshot,
  fileExists,
  hasFileChanged,
  dumpDebugArtifacts
};
