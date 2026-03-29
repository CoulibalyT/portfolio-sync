const fs = require('fs').promises;
const path = require('path');

async function loadConfig(configPath) {
  try {
    const fullPath = path.resolve(process.cwd(), configPath);
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    const config = JSON.parse(fileContent);
    
    // Validation complète
    validateConfig(config);

    // Définir les options par défaut
    config.options = {
      quality: 90,
      format: 'webp',
      waitFor: 2000,
      fullPage: false,
      retries: 3,
      ...config.options
    };

    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath}\nRun "portfolio-sync init" to create one.`);
    }
    throw error;
  }
}

const SUPPORTED_AUTH_TYPES = ['form', 'basic', 'bearer', 'cookie', 'custom'];

function validateConfig(config) {
  if (!config.projects || !Array.isArray(config.projects) || config.projects.length === 0) {
    throw new Error('Config must contain a non-empty "projects" array');
  }

  for (const project of config.projects) {
    const name = project.name || '<unnamed>';

    if (!project.name) {
      throw new Error(`Project '${name}': missing required field 'name'`);
    }
    if (!project.url) {
      throw new Error(`Project '${name}': missing required field 'url'`);
    }
    if (!project.pages || !Array.isArray(project.pages) || project.pages.length === 0) {
      throw new Error(`Project '${name}': missing required field 'pages' (must be a non-empty array)`);
    }
    if (!project.outputDir) {
      throw new Error(`Project '${name}': missing required field 'outputDir'`);
    }

    for (const page of project.pages) {
      if (!page.path && page.path !== '') {
        throw new Error(`Project '${name}': each page must have a 'path' field`);
      }
      if (!page.name) {
        throw new Error(`Project '${name}': each page must have a 'name' field`);
      }
    }

    if (project.auth && project.auth.type) {
      if (!SUPPORTED_AUTH_TYPES.includes(project.auth.type)) {
        throw new Error(`Project '${name}': unsupported auth type '${project.auth.type}'. Supported: ${SUPPORTED_AUTH_TYPES.join(', ')}`);
      }
    }
  }
}

function validateProject(project) {
  if (!project.name) {
    throw new Error('Project must have a "name" property');
  }
  if (!project.url) {
    throw new Error(`Project "${project.name}" must have a "url" property`);
  }
  if (!project.pages || !Array.isArray(project.pages)) {
    throw new Error(`Project "${project.name}" must have a "pages" array`);
  }
  if (!project.outputDir) {
    throw new Error(`Project "${project.name}" must have an "outputDir" property`);
  }
  
  return true;
}

module.exports = {
  loadConfig,
  validateConfig,
  validateProject
};
