const path = require('path');
const chalk = require('chalk');

/**
 * Authentification pour Puppeteer
 * Supporte différents types d'authentification
 */

async function authenticate(page, authConfig, projectUrl) {
  if (!authConfig || !authConfig.type) {
    return; // Pas d'authentification nécessaire
  }

  console.log(chalk.blue(`   🔐 Authenticating...`));

  switch (authConfig.type) {
    case 'form':
      await authenticateWithForm(page, authConfig, projectUrl);
      break;
    case 'basic':
      await authenticateWithBasicAuth(page, authConfig);
      break;
    case 'bearer':
      await authenticateWithBearer(page, authConfig);
      break;
    case 'cookie':
      await authenticateWithCookie(page, authConfig);
      break;
    case 'custom':
      await authenticateWithCustom(page, authConfig, projectUrl);
      break;
    default:
      throw new Error(`Unsupported authentication type: ${authConfig.type}`);
  }

  console.log(chalk.green(`   ✓ Authentication successful`));
}

/**
 * Authentification par formulaire de login
 */
async function authenticateWithForm(page, authConfig, projectUrl) {
  const {
    loginUrl,
    usernameSelector,
    passwordSelector,
    submitSelector,
    username,
    password,
    waitForSelector
  } = authConfig;

  // Remplacer les variables d'environnement
  const resolvedUsername = resolveEnvVar(username);
  const resolvedPassword = resolveEnvVar(password);

  if (!resolvedUsername || !resolvedPassword) {
    throw new Error('Username and password are required for form authentication');
  }

  // Naviguer vers la page de login
  const fullLoginUrl = loginUrl.startsWith('http') 
    ? loginUrl 
    : `${projectUrl}${loginUrl}`;
  
  await page.goto(fullLoginUrl, { waitUntil: 'networkidle2' });

  // Attendre que le formulaire soit visible
  await page.waitForSelector(usernameSelector, { timeout: 10000 });

  // Remplir le formulaire
  await page.type(usernameSelector, resolvedUsername);
  await page.type(passwordSelector, resolvedPassword);

  // Soumettre le formulaire
  const currentUrl = page.url();
  await page.click(submitSelector);

  // Attendre que l'URL change (routing SPA) ou qu'un sélecteur apparaisse
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: 15000 });
  } else {
    await page.waitForFunction(
      (url) => window.location.href !== url,
      { timeout: 15000 },
      currentUrl
    );
  }
}

/**
 * Authentification HTTP Basic
 */
async function authenticateWithBasicAuth(page, authConfig) {
  const { username, password } = authConfig;

  const resolvedUsername = resolveEnvVar(username);
  const resolvedPassword = resolveEnvVar(password);

  if (!resolvedUsername || !resolvedPassword) {
    throw new Error('Username and password are required for basic authentication');
  }

  await page.authenticate({
    username: resolvedUsername,
    password: resolvedPassword
  });
}

/**
 * Authentification par Bearer Token
 */
async function authenticateWithBearer(page, authConfig) {
  const { token, headerName = 'Authorization' } = authConfig;

  const resolvedToken = resolveEnvVar(token);

  if (!resolvedToken) {
    throw new Error('Token is required for bearer authentication');
  }

  // Intercepter les requêtes pour ajouter le header
  await page.setExtraHTTPHeaders({
    [headerName]: `Bearer ${resolvedToken}`
  });
}

/**
 * Authentification par Cookie
 */
async function authenticateWithCookie(page, authConfig) {
  const { cookies } = authConfig;

  if (!cookies || !Array.isArray(cookies)) {
    throw new Error('Cookies array is required for cookie authentication');
  }

  // Résoudre les variables d'environnement dans les cookies
  const resolvedCookies = cookies.map(cookie => ({
    ...cookie,
    value: resolveEnvVar(cookie.value)
  }));

  await page.setCookie(...resolvedCookies);
}

/**
 * Authentification personnalisée avec fonction JavaScript
 */
async function authenticateWithCustom(page, authConfig, projectUrl) {
  const { script, scriptFile } = authConfig;

  if (!script && !scriptFile) {
    throw new Error('Either "script" or "scriptFile" is required for custom authentication');
  }

  // Naviguer vers la page si nécessaire
  if (authConfig.navigateTo) {
    const navigateUrl = authConfig.navigateTo.startsWith('http')
      ? authConfig.navigateTo
      : `${projectUrl}${authConfig.navigateTo}`;

    await page.goto(navigateUrl, { waitUntil: 'networkidle2' });
  }

  if (scriptFile) {
    // Charger un module JS externe exportant une fonction (page, context) => Promise<void>.
    // Permet un script lintable/testable avec accès direct à process.env.
    const absPath = path.resolve(process.cwd(), scriptFile);
    let mod;
    try {
      mod = require(absPath);
    } catch (err) {
      if (err && err.code === 'ERR_REQUIRE_ESM') {
        mod = await import(absPath);
      } else {
        throw err;
      }
    }
    const handler = typeof mod === 'function' ? mod : (mod && mod.default);
    if (typeof handler !== 'function') {
      throw new Error(`scriptFile at ${scriptFile} must export a function(page, context)`);
    }
    await handler(page, { projectUrl, env: process.env });
  } else {
    // Résoudre les variables d'environnement inline (${VAR}) avant exécution.
    // AVERTISSEMENT : ce script est exécuté directement dans le navigateur.
    // Ne jamais utiliser une config provenant d'une source non fiable.
    const resolvedScript = resolveEnvVarsInString(script);
    await page.evaluate(resolvedScript);
  }

  // Attendre un sélecteur (plus fiable) ou à défaut un délai
  if (authConfig.waitForSelector) {
    await page.waitForSelector(authConfig.waitForSelector, { timeout: 15000 });
  } else if (authConfig.waitFor) {
    await new Promise(resolve => setTimeout(resolve, authConfig.waitFor));
  }
}

/**
 * Résoudre les variables d'environnement
 * Format: ${VAR_NAME} ou $VAR_NAME
 */
function resolveEnvVar(value) {
  if (typeof value !== 'string') {
    return value;
  }

  // Format ${VAR_NAME}
  const envVarMatch = value.match(/^\$\{([^}]+)\}$/);
  if (envVarMatch) {
    const envVar = process.env[envVarMatch[1]];
    if (!envVar) {
      throw new Error(`Environment variable ${envVarMatch[1]} is not defined`);
    }
    return envVar;
  }

  // Format $VAR_NAME
  const simpleEnvMatch = value.match(/^\$([A-Z_][A-Z0-9_]*)$/);
  if (simpleEnvMatch) {
    const envVar = process.env[simpleEnvMatch[1]];
    if (!envVar) {
      throw new Error(`Environment variable ${simpleEnvMatch[1]} is not defined`);
    }
    return envVar;
  }

  return value;
}

/**
 * Résoudre les variables d'environnement inline dans une chaîne multi-variable.
 * Contrairement à resolveEnvVar (qui n'accepte qu'une valeur ${VAR} seule),
 * cette fonction remplace toutes les occurrences de ${VAR} dans une chaîne —
 * utilisé pour les scripts custom où plusieurs variables peuvent apparaître.
 */
function resolveEnvVarsInString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, varName) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new Error(`Environment variable ${varName} is not defined`);
    }
    return value;
  });
}

/**
 * Vérifier si l'utilisateur est toujours authentifié
 */
async function isAuthenticated(page, authConfig) {
  if (!authConfig || !authConfig.checkSelector) {
    return true;
  }

  try {
    await page.waitForSelector(authConfig.checkSelector, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  authenticate,
  isAuthenticated,
  resolveEnvVar,
  resolveEnvVarsInString
};
