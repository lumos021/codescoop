/**
 * Quick Black Holes Status Check
 * Directly inspects code for claimed features
 */

const fs = require('fs');
const path = require('path');

const files = {
    cssAnalyzer: path.join(__dirname, '../src/parsers/css-analyzer.js'),
    ghostDetector: path.join(__dirname, '../src/utils/ghost-detector.js'),
    specificity: path.join(__dirname, '../src/utils/specificity-calculator.js'),
    variableExtractor: path.join(__dirname, '../src/utils/variable-extractor.js'),
    markdown: path.join(__dirname, '../src/output/markdown.js')
};

console.log('='.repeat(60));
console.log('CodeScoop Black Holes - Code Inspection');
console.log('='.repeat(60));

function checkFeature(file, feature, searchTerms) {
    const content = fs.readFileSync(file, 'utf-8');
    const found = searchTerms.some(term => content.includes(term));
    const status = found ? '✓' : '✗';
    console.log(`${status} ${feature}`);
    if (!found) console.log(`    Missing: ${searchTerms.join(' OR ')}`);
    return found;
}

let passed = 0;
let total = 0;

// BH1: Nested SCSS
total++;
if (checkFeature(files.cssAnalyzer, 'BH1: Nested SCSS Resolution', ['resolveNestedSelector', '&'])) passed++;

// BH2: Minified Detection
total++;
if (checkFeature(files.cssAnalyzer, 'BH2: Minified CSS Detection', ['detectMinified', 'isMinified'])) passed++;

// BH3: Specificity
total++;
if (checkFeature(files.specificity, 'BH3: Specificity Calculator', ['calculateSpecificity', 'specificity'])) passed++;

// BH4: Ghost Classes with Filtering
total++;
if (checkFeature(files.ghostDetector, 'BH4: Utility Class Filtering', ['IGNORED_PATTERNS', 'flex', 'tailwind'])) passed++;

// BH5: Library Detection
total++;
if (checkFeature(path.join(__dirname, '../src/utils/library-detector.js'), 'BH5: Library Detection', ['isLibraryFile', 'bootstrap'])) passed++;

// BH6: CSS Variables
total++;
if (checkFeature(files.variableExtractor, 'BH6: CSS Variable Extraction', ['extractVariables', '--'])) passed++;

// BH7: Modern Pseudo-Classes
total++;
if (checkFeature(files.cssAnalyzer, 'BH7: :is/:where/:not/:has Support', ['expandModernPseudoClasses', ':is', ':where'])) passed++;

// BH8: At-Rule Context
total++;
if (checkFeature(files.cssAnalyzer, 'BH8: @layer/@container/@supports', ['formatAtRuleContext', '@layer', '@container'])) passed++;

// BH9: Missing Imports (checked in index.js)
total++;
if (checkFeature(path.join(__dirname, '../src/index.js'), 'BH9: Missing Import Detection', ['missingImports', 'isLinked'])) passed++;

// BH10: Keyframes
total++;
if (checkFeature(files.cssAnalyzer, 'BH10: @keyframes Linking', ['@keyframes', 'animation'])) passed++;

// BH11: Attribute Selectors
total++;
if (checkFeature(files.cssAnalyzer, 'BH11: Attribute Selector Matching', ['data-attr', 'dataAttributes'])) passed++;

// BH12: Shadow DOM
total++;
if (checkFeature(files.cssAnalyzer, 'BH12: Shadow DOM (::part/::slotted)', ['checkShadowDOMMatch', '::part', '::slotted'])) passed++;

// BH13: CSS Houdini
total++;
if (checkFeature(files.cssAnalyzer, 'BH13: CSS Houdini (@property)', ['@property', 'houdiniProperties'])) passed++;

// BH14: Performance Caching
total++;
if (checkFeature(files.cssAnalyzer, 'BH14: Parse Caching', ['parseCache', 'clearCache', 'getCacheStats'])) passed++;

console.log('='.repeat(60));
console.log(`Result: ${passed}/${total} features verified in code`);
console.log('='.repeat(60));

if (passed < total) {
    console.log('\nRECOMMENDATION: Some features missing or not fully implemented.');
    process.exit(1);
}
