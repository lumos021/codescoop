/**
 * JavaScript Analyzer Module
 * Finds JS code that references the target element
 * Supports: .js, .min.js, handles minified code
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const acornLoose = require('acorn-loose');
const walk = require('acorn-walk');
const beautify = require('js-beautify').js;

/**
 * Analyze a JavaScript file for references to the target element
 * @param {string} filePath - Path to JS file
 * @param {Object} targetInfo - Target element information
 * @param {Object} options - Options
 * @returns {Object} Analysis result
 */
async function analyzeJS(filePath, targetInfo, options = {}) {
    const { verbose = false } = options;
    const log = verbose ? console.log : () => { };

    let content;
    let originalContent;

    try {
        originalContent = fs.readFileSync(filePath, 'utf-8');
        content = originalContent;
    } catch (error) {
        log(`  Warning: Could not read ${filePath}: ${error.message}`);
        return { filePath, matches: [], error: error.message };
    }

    // Detect if minified
    const isMinified = detectMinified(content);

    // If minified, beautify for better analysis
    let beautifiedContent = content;
    if (isMinified) {
        try {
            beautifiedContent = beautify(content, {
                indent_size: 2,
                space_in_empty_paren: true
            });
        } catch (e) {
            // If beautification fails, continue with original
            log(`  Warning: Could not beautify ${filePath}`);
        }
    }

    const matches = [];

    // Build search patterns
    const patterns = buildSearchPatterns(targetInfo);

    // Method 1: AST-based analysis (more accurate)
    try {
        const astMatches = analyzeWithAST(beautifiedContent, patterns, targetInfo);
        matches.push(...astMatches);
    } catch (error) {
        log(`  AST parsing failed for ${filePath}, falling back to regex`);
        // Method 2: Regex-based fallback (for malformed JS)
        const regexMatches = analyzeWithRegex(beautifiedContent, patterns, targetInfo);
        matches.push(...regexMatches);
    }

    // Deduplicate matches
    const uniqueMatches = deduplicateMatches(matches);

    return {
        filePath,
        relativePath: path.relative(process.cwd(), filePath),
        matches: uniqueMatches,
        isMinified,
        wasBeautified: isMinified,
        originalContent: isMinified ? originalContent : null,
        beautifiedContent: isMinified ? beautifiedContent : null
    };
}

/**
 * Build search patterns for the target element
 */
function buildSearchPatterns(targetInfo) {
    const patterns = [];

    // Class patterns
    targetInfo.classes.forEach(cls => {
        patterns.push({
            type: 'class',
            value: cls,
            // Various ways classes are referenced in JS
            regexPatterns: [
                new RegExp(`['"]\\.${escapeRegex(cls)}['"]`, 'g'),  // '.class'
                new RegExp(`['"]${escapeRegex(cls)}['"]`, 'g'),     // 'class' (for classList)
                new RegExp(`\\.${escapeRegex(cls)}(?=[\\s'"\\]])`, 'g'), // .class in selectors
            ],
            stringPatterns: [
                `.${cls}`,
                `'${cls}'`,
                `"${cls}"`,
                `\`${cls}\``
            ]
        });
    });

    // ID patterns
    targetInfo.ids.forEach(id => {
        patterns.push({
            type: 'id',
            value: id,
            regexPatterns: [
                new RegExp(`['"]#${escapeRegex(id)}['"]`, 'g'),     // '#id'
                new RegExp(`getElementById\\s*\\(\\s*['"]${escapeRegex(id)}['"]`, 'g'),
            ],
            stringPatterns: [
                `#${id}`,
                `'${id}'`,
                `"${id}"`,
                `getElementById('${id}')`,
                `getElementById("${id}")`
            ]
        });
    });

    // Data attribute patterns
    targetInfo.dataAttributes.forEach(attr => {
        patterns.push({
            type: 'data-attr',
            value: attr,
            regexPatterns: [
                new RegExp(`['"]\\[${escapeRegex(attr)}`, 'g'),
                new RegExp(`dataset\\.${escapeRegex(attr.replace('data-', '').replace(/-([a-z])/g, (_, l) => l.toUpperCase()))}`, 'g'),
            ],
            stringPatterns: [
                `[${attr}]`,
                attr
            ]
        });
    });

    return patterns;
}

/**
 * Analyze JS using AST parsing
 */
function analyzeWithAST(content, patterns, targetInfo) {
    const matches = [];
    const lines = content.split('\n');

    // Parse with acorn, falling back to loose parsing
    let ast;
    try {
        ast = acorn.parse(content, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true,
            allowHashBang: true,
            allowReserved: true
        });
    } catch (e) {
        ast = acornLoose.parse(content, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true
        });
    }

    // Walk the AST looking for relevant patterns
    walk.simple(ast, {
        // Look for string literals
        Literal(node) {
            if (typeof node.value !== 'string') return;

            const match = checkStringMatch(node.value, patterns);
            if (match) {
                const startLine = node.loc?.start?.line || 1;
                const endLine = node.loc?.end?.line || startLine;

                // Get surrounding context (the statement containing this literal)
                const contextLines = getContextLines(lines, startLine - 1, 2);

                matches.push({
                    type: 'string-literal',
                    matchedOn: match.matchedOn,
                    content: contextLines.content,
                    startLine: contextLines.startLine,
                    endLine: contextLines.endLine,
                    value: node.value
                });
            }
        },

        // Look for template literals
        TemplateLiteral(node) {
            // Get the full template string
            const quasis = node.quasis.map(q => q.value.raw).join('');

            const match = checkStringMatch(quasis, patterns);
            if (match) {
                const startLine = node.loc?.start?.line || 1;
                const endLine = node.loc?.end?.line || startLine;

                const contextLines = getContextLines(lines, startLine - 1, 2);

                matches.push({
                    type: 'template-literal',
                    matchedOn: match.matchedOn,
                    content: contextLines.content,
                    startLine: contextLines.startLine,
                    endLine: contextLines.endLine
                });
            }
        },

        // Look for querySelector, getElementById, etc.
        CallExpression(node) {
            if (node.callee.type === 'MemberExpression') {
                const methodName = node.callee.property?.name;

                const selectorMethods = [
                    'querySelector', 'querySelectorAll',
                    'getElementById', 'getElementsByClassName',
                    'getElementsByTagName', 'closest', 'matches'
                ];

                // jQuery-style selectors
                const jQueryMethods = ['find', 'children', 'parent', 'parents', 'siblings'];

                if (selectorMethods.includes(methodName) || jQueryMethods.includes(methodName)) {
                    // Check the first argument
                    const firstArg = node.arguments[0];
                    if (firstArg && (firstArg.type === 'Literal' || firstArg.type === 'TemplateLiteral')) {
                        const argValue = firstArg.type === 'Literal'
                            ? firstArg.value
                            : firstArg.quasis?.map(q => q.value.raw).join('');

                        if (typeof argValue === 'string') {
                            const match = checkStringMatch(argValue, patterns);
                            if (match) {
                                const startLine = node.loc?.start?.line || 1;
                                const endLine = node.loc?.end?.line || startLine;

                                const contextLines = getContextLines(lines, startLine - 1, 3);

                                matches.push({
                                    type: 'dom-query',
                                    method: methodName,
                                    matchedOn: match.matchedOn,
                                    content: contextLines.content,
                                    startLine: contextLines.startLine,
                                    endLine: contextLines.endLine,
                                    selector: argValue
                                });
                            }
                        }
                    }
                }
            }

            // Check for jQuery $() calls
            if (node.callee.name === '$' || node.callee.name === 'jQuery') {
                const firstArg = node.arguments[0];
                if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
                    const match = checkStringMatch(firstArg.value, patterns);
                    if (match) {
                        const startLine = node.loc?.start?.line || 1;
                        const endLine = node.loc?.end?.line || startLine;

                        const contextLines = getContextLines(lines, startLine - 1, 3);

                        matches.push({
                            type: 'jquery',
                            matchedOn: match.matchedOn,
                            content: contextLines.content,
                            startLine: contextLines.startLine,
                            endLine: contextLines.endLine,
                            selector: firstArg.value
                        });
                    }
                }
            }
        },

        // Look for classList operations
        MemberExpression(node) {
            if (node.property?.name === 'classList') {
                // This is accessing classList, the actual class name will be in the parent call
                // This is handled by CallExpression above
            }
        }
    });

    return matches;
}

/**
 * Fallback regex-based analysis for malformed JS
 */
function analyzeWithRegex(content, patterns, targetInfo) {
    const matches = [];
    const lines = content.split('\n');

    // Common DOM query patterns
    const domPatterns = [
        /document\.querySelector\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        /document\.querySelectorAll\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        /document\.getElementById\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        /document\.getElementsByClassName\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        /\$\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        /jQuery\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    ];

    // Search for each pattern
    for (const pattern of patterns) {
        for (const strPattern of pattern.stringPatterns) {
            let lineNum = 0;
            for (const line of lines) {
                lineNum++;
                if (line.includes(strPattern)) {
                    const contextLines = getContextLines(lines, lineNum - 1, 2);

                    matches.push({
                        type: 'regex-match',
                        matchedOn: [`${pattern.type}: ${pattern.value}`],
                        content: contextLines.content,
                        startLine: contextLines.startLine,
                        endLine: contextLines.endLine
                    });
                }
            }
        }
    }

    return matches;
}

/**
 * Check if a string matches any of our patterns
 */
function checkStringMatch(str, patterns) {
    const matchedOn = [];

    for (const pattern of patterns) {
        for (const strPattern of pattern.stringPatterns) {
            if (str.includes(strPattern) || str === pattern.value) {
                matchedOn.push(`${pattern.type}: ${pattern.value}`);
                break;
            }
        }
    }

    return matchedOn.length > 0 ? { matchedOn } : null;
}

/**
 * Get context lines around a match
 */
function getContextLines(lines, centerIndex, contextSize) {
    const startIndex = Math.max(0, centerIndex - contextSize);
    const endIndex = Math.min(lines.length - 1, centerIndex + contextSize);

    const contextLines = lines.slice(startIndex, endIndex + 1);

    return {
        content: contextLines.join('\n'),
        startLine: startIndex + 1,
        endLine: endIndex + 1
    };
}

/**
 * Deduplicate matches based on content
 */
function deduplicateMatches(matches) {
    const seen = new Set();
    return matches.filter(match => {
        const key = `${match.startLine}-${match.endLine}-${match.content}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Detect if JS content is minified
 */
function detectMinified(content) {
    const lines = content.split('\n');
    if (lines.length === 0) return false;

    const avgLineLength = content.length / lines.length;
    const newlineRatio = lines.length / content.length;

    // Also check for common minification patterns
    const hasLongLines = lines.some(line => line.length > 500);

    return avgLineLength > 200 || newlineRatio < 0.002 || hasLongLines;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    analyzeJS
};
