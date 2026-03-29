#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { Command } = require('commander');
const chalk = require('chalk');
const { captureProjects } = require('../src/capturer');
const { loadConfig } = require('../src/config');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('portfolio-sync')
  .description('Automatically capture and sync screenshots of your live projects')
  .version(packageJson.version);

program
  .command('capture')
  .description('Capture screenshots of all configured projects')
  .option('-c, --config <path>', 'Path to config file', 'portfolio-sync.config.json')
  .option('-p, --project <name>', 'Capture only specific project')
  .option('-d, --dry-run', 'Show what would be captured without actually doing it')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n📸 Portfolio Sync - Starting capture...\n'));

      const config = await loadConfig(options.config);
      await captureProjects(config, options.project, options.dryRun);

      if (!options.dryRun) {
        console.log(chalk.green.bold('\n✅ All screenshots captured successfully!\n'));
      }
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a sample configuration file')
  .action(async () => {
    const fs = require('fs').promises;
    const path = require('path');
    
    const sampleConfig = {
      projects: [
        {
          name: "example-project",
          url: "https://example.com",
          pages: [
            { path: "/", name: "home" },
            { path: "/about", name: "about" }
          ],
          viewport: { width: 1920, height: 1080 },
          outputDir: "./public/images/example-project"
        }
      ],
      options: {
        quality: 90,
        format: "webp",
        waitFor: 2000,
        fullPage: false
      }
    };
    
    const configPath = path.join(process.cwd(), 'portfolio-sync.config.json');
    
    try {
      await fs.writeFile(configPath, JSON.stringify(sampleConfig, null, 2));
      console.log(chalk.green.bold('✅ Configuration file created: portfolio-sync.config.json'));
      console.log(chalk.blue('\nEdit this file with your project details and run:'));
      console.log(chalk.white('  portfolio-sync capture\n'));
    } catch (error) {
      console.error(chalk.red.bold('❌ Error creating config file:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all configured projects and their pages')
  .option('-c, --config <path>', 'Path to config file', 'portfolio-sync.config.json')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);

      console.log(chalk.blue.bold('\n📋 Configured projects:\n'));

      for (const project of config.projects) {
        const pageNames = project.pages.map(p => p.name || p.path).join(', ');
        const authType = project.auth && project.auth.type ? project.auth.type : 'none';

        console.log(chalk.blue.bold(`📦 ${project.name}`) + chalk.gray(` (${project.url})`));
        console.log(chalk.white(`   ${project.pages.length} pages: ${pageNames}`));
        console.log(chalk.white(`   Auth: ${authType}`));
        console.log(chalk.white(`   Output: ${project.outputDir}`));
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red.bold('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
