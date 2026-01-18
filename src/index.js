/**
 * Main orchestrator for html-scan
 */

const fs = require('fs');
const path = require('path');
const { parseHTML, extractTargetElement } = require('./parsers/html-parser');
const { analyzeCSS } = require('./parsers/css-analyzer');
const { analyzeJS } = require('./parsers/js-analyzer');
const { findProjectFiles, getLinkedFiles } = require('./utils/file-scanner');
const { generateMarkdown } = require('./output/markdown');
const {
    detectLibrariesFromPaths,
    detectLibrariesFromHTML,
    detectLibrariesFromClasses,
    isLibraryFile
} = require('./utils/library-detector');
const { extractVariablesFromMatches } = require('./utils/variable-extractor');

/**
 * Run the full analysis
 * @param {Object} options
 * @param {string} options.htmlPath - Path to HTML file
 * @param {string} options.projectDir - Project directory to scan
 * @param {string} options.selector - CSS selector to target
 * @param {string} options.lineRange - Line range (e.g., "45-80")
 * @param {string} options.outputPath - Output file path
 * @param {boolean} options.includeInline - Include inline styles/scripts
 * @param {boolean} options.verbose - Verbose logging
 */
async function runAnalysis(options) {
    const {
        htmlPath,
        projectDir,
        selector,
        lineRange,
        matchIndex = 0,
        outputPath,
        includeInline = true,
        verbose = false,
        // Compact mode options
        compact = false,
        forConversion = false,
        maxRulesPerFile = 20,
        maxJsPerFile = 10,
        summaryOnly = false,
        skipMinified = false,
        // URL/Template mode support
        htmlContent: preloadedContent = null,
        sourceType = 'file'
    } = options;

    const log = verbose ? console.log : () => { };

    // Step 1: Parse HTML and extract target element
    log('Parsing HTML file...');

    // Use pre-loaded content (from URL/template) or read from file
    let htmlContent;
    if (preloadedContent) {
        htmlContent = preloadedContent;
        log(`Using pre-loaded HTML content (${sourceType} mode)`);
    } else {
        htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    }

    const parsedHTML = parseHTML(htmlContent);

    const targetInfo = extractTargetElement(parsedHTML, htmlContent, {
        selector,
        lineRange,
        matchIndex
    });

    log(`Target element: ${targetInfo.summary}`);
    log(`Classes: ${targetInfo.classes.join(', ') || 'none'}`);
    log(`IDs: ${targetInfo.ids.join(', ') || 'none'}`);

    // Step 2: Find all CSS/JS files in project (skip if no projectDir for URL mode)
    log('\nScanning project for CSS/JS files...');
    let projectFiles = { css: [], js: [] };
    if (projectDir) {
        projectFiles = await findProjectFiles(projectDir);
    }
    log(`Found ${projectFiles.css.length} CSS files, ${projectFiles.js.length} JS files`);

    // Step 3: Get files that are actually linked in HTML
    const linkedFiles = getLinkedFiles(parsedHTML, htmlPath);
    log(`Linked in HTML: ${linkedFiles.css.length} CSS, ${linkedFiles.js.length} JS`);

    // Step 4: Detect libraries
    log('\nDetecting libraries...');
    const allFiles = [...projectFiles.css, ...projectFiles.js];
    const librariesFromFiles = detectLibrariesFromPaths(allFiles);
    const librariesFromCDN = detectLibrariesFromHTML(parsedHTML);
    const librariesFromClasses = detectLibrariesFromClasses(targetInfo.classes);

    // Combine library info
    const detectedLibraries = {
        fromFiles: librariesFromFiles,
        fromCDN: librariesFromCDN,
        fromClasses: librariesFromClasses
    };
    log(`Detected ${Object.keys(librariesFromFiles).length} libraries from files`);
    log(`Detected ${librariesFromCDN.length} libraries from CDN`);

    // Step 5: Analyze all CSS files (separating libraries from custom code)
    log('\nAnalyzing CSS files...');
    const cssResults = [];
    const cssLibraryResults = [];

    for (const cssFile of projectFiles.css) {
        const libInfo = isLibraryFile(cssFile);
        const result = await analyzeCSS(cssFile, targetInfo, { verbose });

        if (result.matches.length > 0) {
            result.isLinked = linkedFiles.css.some(f =>
                path.resolve(f) === path.resolve(cssFile)
            );
            result.isLibrary = !!libInfo;
            result.libraryName = libInfo?.name || null;

            if (libInfo) {
                cssLibraryResults.push(result);
            } else {
                cssResults.push(result);
            }
        }
    }

    // Step 6: Analyze inline styles if requested
    let inlineStyles = [];
    if (includeInline) {
        log('Extracting inline styles...');
        inlineStyles = extractInlineStyles(parsedHTML, targetInfo);
    }

    // Step 7: Analyze all JS files (separating libraries from custom code)
    log('\nAnalyzing JavaScript files...');
    const jsResults = [];
    const jsLibraryResults = [];

    for (const jsFile of projectFiles.js) {
        const libInfo = isLibraryFile(jsFile);
        const result = await analyzeJS(jsFile, targetInfo, { verbose });

        if (result.matches.length > 0) {
            result.isLinked = linkedFiles.js.some(f =>
                path.resolve(f) === path.resolve(jsFile)
            );
            result.isLibrary = !!libInfo;
            result.libraryName = libInfo?.name || null;

            if (libInfo) {
                jsLibraryResults.push(result);
            } else {
                jsResults.push(result);
            }
        }
    }

    // Step 8: Analyze inline scripts if requested
    let inlineScripts = [];
    if (includeInline) {
        log('Extracting inline scripts...');
        inlineScripts = extractInlineScripts(parsedHTML, targetInfo);
    }

    // Step 9: Identify missing imports (only for custom files, not libraries)
    const missingImports = [
        ...cssResults.filter(r => !r.isLinked).map(r => r.filePath),
        ...jsResults.filter(r => !r.isLinked).map(r => r.filePath)
    ];

    // Step 10: Extract CSS/SCSS variable definitions
    log('Extracting variable definitions...');
    const allCSSMatches = [
        ...cssResults.flatMap(r => r.matches || []),
        ...inlineStyles.map(s => ({ content: s.content }))
    ];
    const allCSSFiles = [...projectFiles.css];
    const variableData = await extractVariablesFromMatches(allCSSMatches, allCSSFiles, projectDir);
    log(`Found ${variableData.usedVariables.length} variables used`);

    // Step 11: Extract and check assets
    log('\nExtracting assets...');
    const { extractCSSAssets } = require('./parsers/css-analyzer');
    const { checkAssetAvailability } = require('./utils/asset-checker');

    // Get HTML assets (already extracted in targetInfo)
    const htmlAssets = targetInfo.assets || { images: [], videos: [], audio: [], icons: [], canvas: [], svgs: [] };

    // Extract CSS assets
    const cssAssets = extractCSSAssets(cssResults);

    // Combine all assets
    const allAssets = [
        ...htmlAssets.images.map(a => ({ ...a, source: 'html' })),
        ...htmlAssets.videos.map(a => ({ ...a, source: 'html' })),
        ...htmlAssets.audio.map(a => ({ ...a, source: 'html' })),
        ...htmlAssets.icons.map(a => ({ ...a, source: 'html' })),
        ...cssAssets.map(a => ({ ...a, source: 'css' }))
    ];

    // Check asset availability
    const assetStatus = await checkAssetAvailability(
        allAssets,
        projectDir || process.cwd(),
        htmlPath,
        { checkRemote: false } // Can be controlled by CLI flag later
    );

    log(`Assets: ${assetStatus.total} total, ${assetStatus.available} available, ${assetStatus.missing} missing`);

    // Step 12: Generate markdown output
    log('\nGenerating markdown report...');
    const analysis = {
        targetInfo,
        htmlPath,
        projectDir,
        cssResults,
        jsResults,
        cssLibraryResults,
        jsLibraryResults,
        detectedLibraries,
        inlineStyles,
        inlineScripts,
        missingImports,
        variableData,
        htmlAssets,
        assetStatus,
        generatedAt: new Date().toISOString(),
        // Output options
        outputOptions: {
            compact,
            forConversion,
            maxRulesPerFile,
            maxJsPerFile,
            summaryOnly,
            skipMinified
        }
    };

    const markdown = generateMarkdown(analysis);

    // Determine output path
    const finalOutputPath = outputPath || generateOutputPath(targetInfo, htmlPath, projectDir);
    fs.writeFileSync(finalOutputPath, markdown, 'utf-8');

    return {
        outputPath: finalOutputPath,
        cssMatches: cssResults.reduce((sum, r) => sum + r.matches.length, 0),
        jsMatches: jsResults.reduce((sum, r) => sum + r.matches.length, 0),
        missingImports,
        libraryCount: Object.keys(librariesFromFiles).length + librariesFromCDN.length
    };
}

/**
 * Extract inline <style> blocks that affect the target
 */
function extractInlineStyles(parsedHTML, targetInfo) {
    const $ = parsedHTML;
    const results = [];

    $('style').each((index, element) => {
        const content = $(element).html();
        if (content) {
            // Check if any target classes/IDs are referenced
            const isRelevant = [...targetInfo.classes, ...targetInfo.ids, targetInfo.tagName]
                .some(identifier => content.includes(identifier));

            if (isRelevant) {
                results.push({
                    index,
                    content: content.trim(),
                    type: 'inline-style'
                });
            }
        }
    });

    return results;
}

/**
 * Extract inline <script> blocks that reference the target
 */
function extractInlineScripts(parsedHTML, targetInfo) {
    const $ = parsedHTML;
    const results = [];

    $('script:not([src])').each((index, element) => {
        const content = $(element).html();
        if (content) {
            // Check if any target classes/IDs are referenced
            const isRelevant = [...targetInfo.classes, ...targetInfo.ids]
                .some(identifier => content.includes(identifier));

            if (isRelevant) {
                results.push({
                    index,
                    content: content.trim(),
                    type: 'inline-script'
                });
            }
        }
    });

    return results;
}

/**
 * Generate output path based on target info
 */
function generateOutputPath(targetInfo, htmlPath, projectDir = null) {
    // For URLs, use projectDir or current working directory
    let outputDir;
    if (htmlPath.startsWith('http://') || htmlPath.startsWith('https://')) {
        outputDir = projectDir || process.cwd();
    } else {
        outputDir = path.dirname(htmlPath);
    }

    const baseName = targetInfo.ids[0]
        || targetInfo.classes[0]
        || targetInfo.tagName
        || 'component';

    // Clean up the name for use as filename
    const cleanName = baseName.replace(/[^a-zA-Z0-9-_]/g, '-');
    return path.join(outputDir, `${cleanName}-analysis.md`);
}

module.exports = { runAnalysis };
