/**
 * CSS Analyzer Module
 * Finds CSS rules that affect the target element
 * Supports: .css, .scss, .sass, .min.css
 * 
 * UPDATES v2.2:
 * - Modern pseudo-class expansion (:is, :where, :not, :has)
 * - @layer, @container, @supports tracking
 * - Improved attribute selector matching
 * - Shadow DOM support (::part, ::slotted)
 * - CSS Houdini (@property)
 * - Performance optimizations for large projects
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');
const sass = require('sass');

// Performance: Cache for parsed CSS to avoid re-parsing
const parseCache = new Map();
const MAX_CACHE_SIZE = 50; // Limit cache size to prevent memory bloat

/**
 * Analyze a CSS file for rules matching the target element
 * @param {string} filePath - Path to CSS/SCSS file
 * @param {Object} targetInfo - Target element information
 * @param {Object} options - Options
 * @returns {Object} Analysis result
 */
async function analyzeCSS(filePath, targetInfo, options = {}) {
    const { verbose = false, useCache = true } = options;
    const log = verbose ? console.log : () => { };

    const ext = path.extname(filePath).toLowerCase();
    let cssContent;
    let originalContent;
    let isScss = false;

    // Performance: Check cache first
    const cacheKey = `${filePath}:${JSON.stringify(targetInfo)}`;
    if (useCache && parseCache.has(cacheKey)) {
        log(`  Using cached result for ${path.basename(filePath)}`);
        return parseCache.get(cacheKey);
    }

    try {
        originalContent = fs.readFileSync(filePath, 'utf-8');

        // Performance: Skip empty files immediately
        if (!originalContent || originalContent.trim().length === 0) {
            return { filePath, matches: [], error: 'Empty file' };
        }

        // Handle different file types
        if (ext === '.scss') {
            isScss = true;
            // Parse SCSS directly without compiling (to preserve source lines)
            cssContent = originalContent;
        } else if (ext === '.sass') {
            // Compile SASS (indented syntax) to CSS
            const result = sass.compileString(originalContent, { syntax: 'indented' });
            cssContent = result.css;
        } else {
            // Regular CSS or minified CSS
            cssContent = originalContent;
        }
    } catch (error) {
        log(`  Warning: Could not read ${filePath}: ${error.message}`);
        return { filePath, matches: [], error: error.message };
    }

    // Parse the CSS/SCSS
    const matches = [];
    const shadowDOMRules = [];
    const houdiniProperties = [];

    try {
        const parseOptions = isScss ? { syntax: postcssScss } : {};
        const root = postcss.parse(cssContent, parseOptions);

        // Build list of selectors to match against
        const targetSelectors = buildTargetSelectors(targetInfo);

        root.walkRules(rule => {
            // Resolve nested selectors (SCSS & and standard nesting)
            const resolvedSelector = resolveNestedSelector(rule);

            // Check for Shadow DOM selectors (::part, ::slotted)
            const shadowDOMMatch = checkShadowDOMMatch(resolvedSelector, targetInfo);
            if (shadowDOMMatch.matches) {
                const ruleContent = rule.toString();

                // Check context
                let atRuleContext = null;
                if (rule.parent && rule.parent.type === 'atrule') {
                    atRuleContext = formatAtRuleContext(rule.parent);
                }

                shadowDOMRules.push({
                    selector: resolvedSelector,
                    originalSelector: rule.selector,
                    content: ruleContent,
                    startLine: rule.source?.start?.line || 0,
                    endLine: rule.source?.end?.line || 0,
                    matchedOn: shadowDOMMatch.matchedOn,
                    shadowDOMType: shadowDOMMatch.type,
                    atRuleContext,
                    isShadowDOM: true
                });
            }

            // Check if this rule matches any of our target selectors
            const matchInfo = checkRuleMatch(resolvedSelector, targetSelectors, targetInfo);

            if (matchInfo.matches) {
                // Get the full rule with its content
                const ruleContent = rule.toString();

                // Calculate line numbers
                const startLine = rule.source?.start?.line || 0;
                const endLine = rule.source?.end?.line || startLine;

                // Check if this rule is inside ANY at-rule (media, layer, container, supports)
                let atRuleContext = null;
                if (rule.parent && rule.parent.type === 'atrule') {
                    atRuleContext = formatAtRuleContext(rule.parent);
                }

                matches.push({
                    selector: resolvedSelector, // Use resolved selector for reporting
                    originalSelector: rule.selector,
                    content: ruleContent,
                    startLine,
                    endLine,
                    matchedOn: matchInfo.matchedOn,
                    atRuleContext,
                    isNested: isScss && rule.selector.includes('&')
                });
            }
        });

        // Find CSS Houdini @property definitions
        root.walkAtRules(atRule => {
            if (atRule.name === 'property') {
                // @property --my-color { ... }
                const propertyName = atRule.params.trim();

                // Check if this property is used in matched rules (standard or shadow DOM)
                const isUsed = matches.some(m => m.content.includes(propertyName)) ||
                    shadowDOMRules.some(m => m.content.includes(propertyName));

                if (isUsed) {
                    // Check context
                    let atRuleContext = null;
                    if (atRule.parent && atRule.parent.type === 'atrule') {
                        atRuleContext = formatAtRuleContext(atRule.parent);
                    }

                    houdiniProperties.push({
                        propertyName,
                        content: atRule.toString(),
                        startLine: atRule.source?.start?.line || 0,
                        endLine: atRule.source?.end?.line || 0,
                        atRuleContext,
                        isHoudini: true
                    });
                }
            } else if (atRule.name === 'keyframes') {
                // Check if any animation name is used on a matched class
                // For now, include all keyframes (could be more selective)
                const animationName = atRule.params;

                // Check if this animation is referenced in matched rules
                const isUsed = matches.some(m =>
                    m.content.includes(animationName) ||
                    m.content.includes(`animation-name: ${animationName}`) ||
                    m.content.includes(`animation: ${animationName}`)
                );

                if (isUsed) {
                    matches.push({
                        selector: `@keyframes ${animationName}`,
                        content: atRule.toString(),
                        startLine: atRule.source?.start?.line || 0,
                        endLine: atRule.source?.end?.line || 0,
                        matchedOn: ['animation'],
                        isKeyframes: true
                    });
                }
            }
        });

    } catch (error) {
        log(`  Warning: Could not parse ${filePath}: ${error.message}`);
        return { filePath, matches: [], error: error.message };
    }

    // Detect if file is minified
    const isMinified = detectMinified(originalContent);

    const result = {
        filePath,
        relativePath: path.relative(process.cwd(), filePath),
        matches,
        shadowDOMRules,
        houdiniProperties,
        isScss,
        isMinified,
        fileType: ext.replace('.', '')
    };

    // Performance: Cache the result
    if (useCache) {
        if (parseCache.size >= MAX_CACHE_SIZE) {
            // Remove oldest entry
            const firstKey = parseCache.keys().next().value;
            parseCache.delete(firstKey);
        }
        parseCache.set(cacheKey, result);
    }

    return result;
}

/**
 * Format at-rule context for display
 * Supports @media, @layer, @container, @supports
 */
function formatAtRuleContext(atRuleNode) {
    const name = atRuleNode.name;
    const params = atRuleNode.params;

    switch (name) {
        case 'layer':
            return `@layer ${params}`;
        case 'container':
            return `@container ${params}`;
        case 'supports':
            return `@supports ${params}`;
        case 'media':
            return `@media ${params}`;
        default:
            return `@${name} ${params}`;
    }
}

/**
 * Build a list of selector patterns to match against
 */
function buildTargetSelectors(targetInfo) {
    const selectors = [];

    // Add class selectors
    targetInfo.classes.forEach(cls => {
        selectors.push({
            type: 'class',
            value: cls,
            pattern: new RegExp(`\\.${escapeRegex(cls)}(?=[\\s,:.\\[#]|$)`)
        });
    });

    // Add ID selectors
    targetInfo.ids.forEach(id => {
        selectors.push({
            type: 'id',
            value: id,
            pattern: new RegExp(`#${escapeRegex(id)}(?=[\\s,:.\\[#]|$)`)
        });
    });

    // Add tag name (be careful with this - only for specific compound selectors)
    if (targetInfo.classes.length > 0 || targetInfo.ids.length > 0) {
        selectors.push({
            type: 'tag',
            value: targetInfo.tagName,
            pattern: new RegExp(`(?:^|[\\s,>+~])${escapeRegex(targetInfo.tagName)}(?=[\\s,:.\\[#>+~]|$)`)
        });
    }

    // Add data attribute selectors (IMPROVED - matches both [attr] and [attr="value"])
    targetInfo.dataAttributes.forEach(attr => {
        selectors.push({
            type: 'data-attr',
            value: attr,
            pattern: new RegExp(`\\[${escapeRegex(attr)}(?:[~|^$*]?=|\\])`)
        });
    });

    return selectors;
}

/**
 * Check for Shadow DOM pseudo-elements (::part, ::slotted)
 * These target elements inside Web Components' shadow DOM
 */
function checkShadowDOMMatch(selector, targetInfo) {
    const matchedOn = [];
    let type = null;

    // Check for ::part() - styles parts of shadow DOM from outside
    if (selector.includes('::part(')) {
        const partMatch = selector.match(/::part\(([^)]+)\)/);
        if (partMatch) {
            const partName = partMatch[1].trim();

            // Check if target has this part attribute
            if (targetInfo.shadowParts?.includes(partName)) {
                matchedOn.push(`part: ${partName}`);
                type = '::part';
            }

            // Also check if any of the target's classes/ids/tagName are mentioned
            const allIdentifiers = [...targetInfo.classes, ...targetInfo.ids, targetInfo.tagName];
            if (allIdentifiers.some(id => id && selector.includes(id))) {
                matchedOn.push(`shadow-host with part`);
                type = '::part';
            }
        }
    }

    // Check for ::slotted() - styles slotted content from inside shadow DOM
    if (selector.includes('::slotted(')) {
        const slottedMatch = selector.match(/::slotted\(([^)]+)\)/);
        if (slottedMatch) {
            const slottedSelector = slottedMatch[1].trim();

            // Check if target matches the slotted selector
            const allIdentifiers = [...targetInfo.classes, ...targetInfo.ids];
            if (allIdentifiers.some(id => slottedSelector.includes(id))) {
                matchedOn.push(`slotted: ${slottedSelector}`);
                type = '::slotted';
            }
        }
    }

    return {
        matches: matchedOn.length > 0,
        matchedOn,
        type
    };
}

/**
 * Expand modern pseudo-class functions to extract inner selectors
 * Handles :is(), :where(), :not(), :has()
 */
function expandModernPseudoClasses(selector) {
    // Extract selectors from :is(), :where(), :not(), :has()
    // We create a space-separated list that includes both original and inner selectors
    let expanded = selector;

    const pseudoFunctions = ['is', 'where', 'not', 'has'];

    for (const func of pseudoFunctions) {
        const regex = new RegExp(`:${func}\\(([^)]+)\\)`, 'g');
        let match;

        while ((match = regex.exec(selector)) !== null) {
            const innerSelectors = match[1];
            // Append inner selectors to make them matchable
            // This allows our pattern matching to find classes/ids inside these functions
            expanded += ` ${innerSelectors}`;
        }
    }

    return expanded;
}

/**
 * Check if a CSS rule selector matches our target
 */
function checkRuleMatch(ruleSelector, targetSelectors, targetInfo) {
    const matchedOn = [];

    // Expand modern pseudo-classes before matching
    const expandedSelector = expandModernPseudoClasses(ruleSelector);

    for (const target of targetSelectors) {
        // Test against both original and expanded selector
        if (target.pattern.test(ruleSelector) || target.pattern.test(expandedSelector)) {
            matchedOn.push(`${target.type}: ${target.value}`);
        }
    }

    return {
        matches: matchedOn.length > 0,
        matchedOn
    };
}

/**
 * Detect if CSS content is minified
 */
function detectMinified(content) {
    const lines = content.split('\n');
    if (lines.length === 0) return false;

    // If average line length is very high, it's likely minified
    const avgLineLength = content.length / lines.length;

    // Also check if there are very few newlines relative to content
    const newlineRatio = lines.length / content.length;

    return avgLineLength > 200 || newlineRatio < 0.002;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format CSS for output (beautify if minified)
 */
function formatCSS(content, isMinified) {
    if (!isMinified) return content;

    // Simple CSS beautification
    return content
        .replace(/\{/g, ' {\n  ')
        .replace(/;/g, ';\n  ')
        .replace(/\}/g, '\n}\n')
        .replace(/,\s*/g, ',\n')
        .replace(/\n\s*\n/g, '\n')
        .trim();
}

/**
 * Resolve nested selectors by unwrapping parent rules
 * Supports SCSS (&) and standard CSS nesting
 */
function resolveNestedSelector(rule) {
    if (!rule.parent || rule.parent.type !== 'rule') {
        return rule.selector;
    }

    const parentSelector = resolveNestedSelector(rule.parent);
    const selfSelector = rule.selector;

    // SCSS-style nesting with &
    if (selfSelector.includes('&')) {
        // Handle comma-separated parent selectors (basic support)
        // .a, .b { &--mod } -> .a--mod, .b--mod
        if (parentSelector.includes(',')) {
            const parents = parentSelector.split(',').map(s => s.trim());
            return parents.map(p => selfSelector.replace(/&/g, p)).join(', ');
        }
        return selfSelector.replace(/&/g, parentSelector);
    }

    // Standard CSS nesting (descendant)
    // .a, .b { .c } -> .a .c, .b .c
    if (parentSelector.includes(',')) {
        const parents = parentSelector.split(',').map(s => s.trim());
        return parents.map(p => `${p} ${selfSelector}`).join(', ');
    }

    return `${parentSelector} ${selfSelector}`;
}

/**
 * Clear the parse cache (useful for long-running processes)
 */
function clearCache() {
    parseCache.clear();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return {
        size: parseCache.size,
        maxSize: MAX_CACHE_SIZE,
        hitRate: parseCache.size > 0 ? 'Cache enabled' : 'Cache empty'
    };
}

module.exports = {
    analyzeCSS,
    formatCSS,
    clearCache,
    getCacheStats
};