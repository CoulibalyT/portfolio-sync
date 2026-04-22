const puppeteer = require('puppeteer');
const ora = require('ora');
const chalk = require('chalk');
const { validateProject } = require('./config');
const { optimizeImage } = require('./optimizer');
const path = require('path');
const { ensureDir, saveScreenshot, hasFileChanged, dumpDebugArtifacts } = require('./utils');
const { authenticate, isAuthenticated } = require('./auth');

const DEFAULT_DEBUG_DIR = './debug';

async function captureProjects(config, projectFilter = null, dryRun = false, captureOptions = {}) {
  const { debug = false, debugDir = DEFAULT_DEBUG_DIR } = captureOptions;
  let projects = config.projects;

  // Filtrer par projet si spécifié
  if (projectFilter) {
    projects = projects.filter(p => p.name === projectFilter);
    if (projects.length === 0) {
      throw new Error(`Project "${projectFilter}" not found in configuration`);
    }
  }

  // Mode dry-run : afficher ce qui serait capturé sans lancer le browser
  if (dryRun) {
    console.log(chalk.yellow.bold('\n🏃 Dry run mode — no screenshots will be taken\n'));
    for (const project of projects) {
      console.log(chalk.blue.bold(`📦 ${project.name}`));
      console.log(chalk.gray(`   URL: ${project.url}`));
      const viewport = project.viewport || { width: 1920, height: 1080 };
      for (const pageConfig of project.pages) {
        const pageName = pageConfig.name || pageConfig.path.replace(/\//g, '_') || 'index';
        const filename = `${pageName}.${config.options.format}`;
        console.log(chalk.white(`   → ${pageName}`));
        console.log(chalk.gray(`     URL: ${project.url}${pageConfig.path}`));
        console.log(chalk.gray(`     Viewport: ${viewport.width}×${viewport.height}`));
        console.log(chalk.gray(`     Output: ${path.join(project.outputDir, filename)}`));
      }
    }
    return;
  }

  // Lancer le navigateur
  const spinner = ora('Launching browser...').start();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  spinner.succeed('Browser launched');

  const summary = { updated: 0, unchanged: 0, failed: 0 };

  try {
    for (const project of projects) {
      await captureProject(browser, project, config.options, summary, { debug, debugDir });
    }
  } finally {
    await browser.close();
  }

  // Afficher le résumé
  console.log(chalk.bold(`\n📊 Summary: ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.failed} failed`));
}

async function captureProject(browser, project, options, summary, captureOptions = {}) {
  const { debug = false, debugDir = DEFAULT_DEBUG_DIR } = captureOptions;
  validateProject(project);

  console.log(chalk.blue.bold(`\n📦 Processing project: ${project.name}`));
  console.log(chalk.gray(`   URL: ${project.url}`));

  // Créer le dossier de sortie
  await ensureDir(project.outputDir);

  const page = await browser.newPage();

  // Configurer le viewport
  const viewport = project.viewport || { width: 1920, height: 1080 };
  await page.setViewport(viewport);

  // Authentification si nécessaire
  if (project.auth) {
    try {
      await authenticate(page, project.auth, project.url);
    } catch (error) {
      console.error(chalk.red(`   ✗ Authentication failed: ${error.message}`));
      if (debug) {
        const base = await dumpDebugArtifacts(page, debugDir, `${project.name}-auth`, error);
        console.error(chalk.gray(`     debug artifacts: ${base}.{png,html,log}`));
      }
      await page.close();
      throw error;
    }
  }

  // Parcourir toutes les pages du projet
  for (const pageConfig of project.pages) {
    // Vérifier l'authentification avant chaque page (optionnel)
    if (project.auth && project.auth.checkSelector) {
      const authenticated = await isAuthenticated(page, project.auth);
      if (!authenticated) {
        console.log(chalk.yellow(`   ⚠ Session expired, re-authenticating...`));
        await authenticate(page, project.auth, project.url);
      }
    }

    const result = await capturePage(page, project, pageConfig, options, { debug, debugDir });
    if (summary && result) {
      summary[result]++;
    }
  }

  await page.close();
}

async function capturePage(page, project, pageConfig, options, captureOptions = {}) {
  const { debug = false, debugDir = DEFAULT_DEBUG_DIR } = captureOptions;
  const url = `${project.url}${pageConfig.path}`;
  const pageName = pageConfig.name || pageConfig.path.replace(/\//g, '_') || 'index';
  const maxRetries = options.retries || 3;

  const spinner = ora(`Capturing ${pageName}...`).start();

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Naviguer vers la page
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Attendre le temps configuré pour que tout soit chargé
      await new Promise(resolve => setTimeout(resolve, options.waitFor || 2000));

      // Vérifier si on a été redirigé vers la page de login
      if (project.auth && project.auth.loginUrl) {
        const currentUrl = page.url();
        const loginPath = project.auth.loginUrl.startsWith('http')
          ? project.auth.loginUrl
          : `${project.url}${project.auth.loginUrl}`;
        if (currentUrl.includes(project.auth.loginUrl) || currentUrl === loginPath) {
          spinner.text = `${pageName} - session expired, re-authenticating...`;
          await authenticate(page, project.auth, project.url);
          // Re-naviguer vers la page cible après re-auth
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, options.waitFor || 2000));
        }
      }

      // Vérifier que l'URL finale matche le pattern attendu — attrape les redirects
      // silencieux vers signin (route guards qui rendent le login sans changer l'URL
      // ne sont pas détectés ici, mais expectedUrlPattern sur une route protégée
      // signalera une URL imprévue).
      if (pageConfig.expectedUrlPattern) {
        const actualUrl = page.url();
        if (!new RegExp(pageConfig.expectedUrlPattern).test(actualUrl)) {
          throw new Error(
            `URL mismatch: expected /${pageConfig.expectedUrlPattern}/, got "${actualUrl}"`
          );
        }
      }

      // Capturer le screenshot
      const screenshotBuffer = await page.screenshot({
        fullPage: pageConfig.fullPage !== undefined ? pageConfig.fullPage : options.fullPage,
        type: 'png'
      });

      // Optimiser l'image
      const optimizedBuffer = await optimizeImage(screenshotBuffer, {
        quality: options.quality,
        format: options.format,
        maxWidth: options.maxWidth
      });

      // Sauvegarder
      const filename = `${pageName}.${options.format}`;
      const fullPath = path.join(project.outputDir, filename);

      // Vérifier si le fichier a changé avant d'écrire
      const changed = await hasFileChanged(fullPath, optimizedBuffer);
      if (changed) {
        await saveScreenshot(project.outputDir, filename, optimizedBuffer);
        spinner.succeed(chalk.green(`${pageName} - ${filename}`));
        return 'updated';
      } else {
        spinner.succeed(chalk.gray(`${pageName} - unchanged`));
        return 'unchanged';
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        spinner.warn(chalk.yellow(`${pageName} - attempt ${attempt}/${maxRetries} failed, retrying...`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        spinner.fail(chalk.red(`Failed to capture ${pageName} after ${maxRetries} attempts: ${error.message}`));
        if (debug) {
          try {
            const base = await dumpDebugArtifacts(page, debugDir, `${project.name}-${pageName}`, lastError);
            console.error(chalk.gray(`     debug artifacts: ${base}.{png,html,log}`));
          } catch (dumpErr) {
            console.error(chalk.gray(`     (debug dump failed: ${dumpErr.message})`));
          }
        }
        return 'failed';
      }
    }
  }
}

module.exports = {
  captureProjects,
  captureProject,
  capturePage
};
