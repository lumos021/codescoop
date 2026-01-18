#!/usr/bin/env node

/**
 * CodeScoop CLI
 * Extract component dependencies for AI-powered React/Next.js conversion
 */

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { runAnalysis } = require('../src/index');
const { runInteractiveMode } = require('../src/cli/interactive');
const {
  validateHTMLFile,
  validateOutputPath,
  validateProjectDir,
  sanitizeSelector,
  formatError
} = require('../src/utils/validation');
const { fetchURL, isURL } = require('../src/utils/url-fetcher');
const { isTemplateFile, parseTemplateFile } = require('../src/utils/template-parser');

// ASCII Art Banner
const banner = `
${chalk.magenta('╔═══════════════════════════════════════════╗')}
${chalk.magenta('║')}  ${chalk.bold.white('🍒 CodeScoop')} ${chalk.gray('- Scoop code for AI')}     ${chalk.magenta('║')}
${chalk.magenta('╚═══════════════════════════════════════════╝')}
`;

program
  .name('codescoop')
  .description('Scoop out component dependencies for AI-powered conversion')
  .version('1.0.0')
  .argument('<source>', 'HTML file, URL, or template (.php, .blade.php, etc.)')
  .option('-s, --selector <selector>', 'CSS selector to target (e.g., ".navbar", "#header")')
  .option('-l, --lines <range>', 'Line range to target (e.g., "45-80")')
  .option('-o, --output <path>', 'Output file path (default: <component>-analysis.md)')
  .option('-d, --dir <path>', 'Project directory to scan (default: directory containing file)')
  .option('-m, --match-index <n>', 'Which match to use if multiple elements found (0-based)', '0')
  .option('-c, --compact', 'Compact mode: limit output size for LLM consumption')
  .option('--for-conversion', 'Generate React/Next.js conversion context for LLMs')
  .option('--max-rules <n>', 'Max CSS rules per file (default: 20 in compact mode)', '20')
  .option('--max-js <n>', 'Max JS references per file (default: 10 in compact mode)', '10')
  .option('--summary-only', 'Only show summary and file list, no code blocks')
  .option('--skip-minified', 'Skip minified files (*.min.css, *.min.js)')
  .option('--no-interactive', 'Skip interactive mode, require --selector or --lines')
  .option('--include-inline', 'Include inline <style> and <script> blocks (default: true)', true)
  .option('--verbose', 'Show detailed logging')
  .action(async (source, options) => {
    console.log(banner);

    let htmlPath;
    let htmlContent = null;
    let projectDir;
    let sourceType = 'file'; // file, url, or template

    try {
      // ============================================
      // STEP 1: Detect source type and get HTML
      // ============================================

      if (isURL(source)) {
        // URL Mode - fetch live page
        sourceType = 'url';
        console.log(chalk.cyan(`🌐 Fetching URL: ${source}`));

        const result = await fetchURL(source);
        if (result.statusCode !== 200) {
          console.error(chalk.red(`✖  HTTP ${result.statusCode} - Failed to fetch URL`));
          process.exit(1);
        }

        htmlContent = result.html;
        htmlPath = source;
        console.log(chalk.green(`✓ Fetched ${(htmlContent.length / 1024).toFixed(1)}KB`));

        // For URL mode, project dir must be specified
        projectDir = options.dir ? path.resolve(options.dir) : null;
        if (!projectDir) {
          console.log(chalk.yellow(`⚠️  No --dir specified. Only inline styles/scripts will be analyzed.`));
          console.log(chalk.gray(`   Use --dir /path/to/project to scan local CSS/JS files.`));
        }

      } else {
        // File Mode - local file
        htmlPath = path.resolve(source);

        // Check file exists
        if (!fs.existsSync(htmlPath)) {
          console.error(chalk.red(`✖  File not found: ${htmlPath}`));
          process.exit(1);
        }

        // Check if it's a template file
        if (isTemplateFile(htmlPath)) {
          sourceType = 'template';
          console.log(chalk.cyan(`📄 Parsing template: ${path.basename(htmlPath)}`));

          const parsed = parseTemplateFile(htmlPath);
          htmlContent = parsed.html;

          if (parsed.warnings.length > 0) {
            parsed.warnings.forEach(w => console.warn(chalk.yellow(`⚠️  ${w}`)));
          }

          if (parsed.dynamicClasses.length > 0) {
            console.log(chalk.yellow(`⚠️  Found ${parsed.dynamicClasses.length} dynamic class attributes`));
          }

          console.log(chalk.green(`✓ Extracted HTML from ${parsed.templateType} template`));

        } else {
          // Standard HTML file
          sourceType = 'file';
          const validation = validateHTMLFile(htmlPath);

          validation.warnings.forEach(w => console.warn(chalk.yellow(`⚠️  ${w}`)));

          if (!validation.valid) {
            validation.errors.forEach(e => console.error(chalk.red(`✖  ${e}`)));
            process.exit(1);
          }
        }

        // Set project directory
        projectDir = options.dir ? path.resolve(options.dir) : path.dirname(htmlPath);

        // Validate project directory
        const dirValidation = validateProjectDir(projectDir);
        dirValidation.warnings.forEach(w => console.warn(chalk.yellow(`⚠️  ${w}`)));

        if (!dirValidation.valid) {
          dirValidation.errors.forEach(e => console.error(chalk.red(`✖  ${e}`)));
          process.exit(1);
        }
      }

      // ============================================
      // STEP 2: Validate options
      // ============================================

      // Validate output path if provided
      if (options.output) {
        const outputValidation = validateOutputPath(options.output);
        outputValidation.warnings.forEach(w => console.warn(chalk.yellow(`⚠️  ${w}`)));

        if (!outputValidation.valid) {
          outputValidation.errors.forEach(e => console.error(chalk.red(`✖  ${e}`)));
          process.exit(1);
        }
      }

      // Validate selector if provided
      if (options.selector) {
        const selectorValidation = sanitizeSelector(options.selector);
        if (!selectorValidation.valid) {
          console.error(chalk.red(`✖  Invalid selector: ${selectorValidation.error}`));
          process.exit(1);
        }
        options.selector = selectorValidation.selector;
      }

      // Validate match index
      const matchIndex = parseInt(options.matchIndex, 10);
      if (isNaN(matchIndex) || matchIndex < 0) {
        console.error(chalk.red(`✖  Invalid match-index: "${options.matchIndex}". Must be a non-negative number.`));
        process.exit(1);
      }

      // Verbose logging
      if (options.verbose) {
        console.log(chalk.gray(`Source type: ${sourceType}`));
        console.log(chalk.gray(`Source: ${htmlPath}`));
        if (projectDir) console.log(chalk.gray(`Project directory: ${projectDir}`));
      }

      // ============================================
      // STEP 3: Interactive mode if needed
      // ============================================

      if (!options.selector && !options.lines) {
        if (options.interactive === false) {
          console.error(chalk.red('Error: --selector or --lines required when --no-interactive is set'));
          console.log(chalk.gray('\nExamples:'));
          console.log(chalk.gray('  codescoop page.html -s ".navbar"'));
          console.log(chalk.gray('  codescoop https://site.com --selector "header" --dir ./theme'));
          console.log(chalk.gray('  codescoop template.php -s ".content"'));
          process.exit(1);
        }

        // Interactive mode only works for local files
        if (sourceType === 'url') {
          console.error(chalk.red('Error: Interactive mode not available for URLs. Use --selector.'));
          process.exit(1);
        }

        console.log(chalk.yellow('No selector specified. Launching interactive mode...\n'));
        const selection = await runInteractiveMode(htmlPath);

        if (!selection) {
          console.log(chalk.gray('No selection made. Exiting.'));
          process.exit(0);
        }

        options.selector = selection.selector;
      }

      // ============================================
      // STEP 4: Run analysis
      // ============================================

      const result = await runAnalysis({
        htmlPath,
        htmlContent, // Pass pre-fetched content for URL/template modes
        projectDir,
        selector: options.selector,
        lineRange: options.lines,
        matchIndex: matchIndex,
        outputPath: options.output,
        includeInline: options.includeInline,
        verbose: options.verbose,
        sourceType,
        // Compact mode options
        compact: options.compact,
        forConversion: options.forConversion,
        maxRulesPerFile: parseInt(options.maxRules, 10) || 20,
        maxJsPerFile: parseInt(options.maxJs, 10) || 10,
        summaryOnly: options.summaryOnly,
        skipMinified: options.skipMinified
      });

      // ============================================
      // STEP 5: Output results
      // ============================================

      console.log(chalk.green(`\n✓ Analysis complete!`));
      console.log(chalk.white(`  Output: ${result.outputPath}`));
      console.log(chalk.gray(`  Found ${result.cssMatches} CSS rules, ${result.jsMatches} JS references`));

      if (result.libraryCount > 0) {
        console.log(chalk.cyan(`  Libraries detected: ${result.libraryCount}`));
      }

      if (result.missingImports && result.missingImports.length > 0) {
        console.log(chalk.yellow(`\n⚠ ${result.missingImports.length} files contain relevant code but are NOT imported:`));
        result.missingImports.slice(0, 5).forEach(file => {
          console.log(chalk.yellow(`  - ${file}`));
        });
        if (result.missingImports.length > 5) {
          console.log(chalk.yellow(`  ... and ${result.missingImports.length - 5} more`));
        }
      }

    } catch (error) {
      console.error(chalk.red(`\n✖  ${formatError(error, options.verbose)}`));
      if (options.verbose) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error(chalk.red(`\n✖  Unexpected error: ${error.message}`));
  console.error(chalk.gray('This is likely a bug. Please report it.'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red(`\n✖  Unhandled promise rejection: ${reason}`));
  process.exit(1);
});

program.parse();
