/**
 * Variable Extractor Module
 * Extracts CSS custom properties and SCSS variables definitions
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract all CSS custom property usages from CSS content
 * @param {string} content - CSS/SCSS content
 * @returns {Set<string>} Set of variable names used
 */
function extractCSSVariableUsages(content) {
    const usages = new Set();

    // Match var(--variable-name) patterns
    const varRegex = /var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*[^)]+)?\)/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
        usages.add(match[1]);
    }

    return usages;
}

/**
 * Extract all SCSS variable usages from SCSS content
 * @param {string} content - SCSS content
 * @returns {Set<string>} Set of variable names used
 */
function extractSCSSVariableUsages(content) {
    const usages = new Set();

    // Match $variable-name patterns (but not in definitions)
    // This regex looks for $ followed by variable name that's NOT at the start of a definition
    const scssVarRegex = /(?<!^\s*)\$([a-zA-Z_][a-zA-Z0-9_-]*)/gm;
    let match;
    while ((match = scssVarRegex.exec(content)) !== null) {
        usages.add('$' + match[1]);
    }

    return usages;
}

/**
 * Find CSS custom property definitions in content
 * @param {string} content - CSS/SCSS content
 * @param {Set<string>} variableNames - Variables to find
 * @returns {Object} Map of variable name to definition
 */
function findCSSVariableDefinitions(content, variableNames) {
    const definitions = {};

    for (const varName of variableNames) {
        // Look for --variable-name: value; pattern
        const escapedName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const defRegex = new RegExp(`(${escapedName})\\s*:\\s*([^;]+);`, 'gm');

        let match;
        while ((match = defRegex.exec(content)) !== null) {
            // Get some context around the match
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const lineEnd = content.indexOf('\n', match.index + match[0].length);
            const line = content.substring(lineStart, lineEnd > -1 ? lineEnd : undefined).trim();

            // Try to find the selector/context
            const beforeMatch = content.substring(Math.max(0, match.index - 200), match.index);
            const selectorMatch = beforeMatch.match(/([^{}]+)\s*\{[^{}]*$/);
            const selector = selectorMatch ? selectorMatch[1].trim().split('\n').pop().trim() : ':root';

            if (!definitions[varName]) {
                definitions[varName] = [];
            }

            definitions[varName].push({
                value: match[2].trim(),
                context: selector,
                fullLine: line
            });
        }
    }

    return definitions;
}

/**
 * Find SCSS variable definitions in content
 * @param {string} content - SCSS content
 * @param {Set<string>} variableNames - Variables to find (with $ prefix)
 * @returns {Object} Map of variable name to definition
 */
function findSCSSVariableDefinitions(content, variableNames) {
    const definitions = {};

    for (const varName of variableNames) {
        // Look for $variable-name: value; pattern at the start of a line
        const escapedName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const defRegex = new RegExp(`^\\s*(${escapedName})\\s*:\\s*([^;]+);`, 'gm');

        let match;
        while ((match = defRegex.exec(content)) !== null) {
            const line = match[0].trim();

            if (!definitions[varName]) {
                definitions[varName] = [];
            }

            definitions[varName].push({
                value: match[2].trim(),
                context: 'global',
                fullLine: line
            });
        }
    }

    return definitions;
}

/**
 * Extract variables from matched CSS rules and find their definitions
 * @param {Array} cssMatches - Array of CSS match objects with content
 * @param {Array} projectFiles - Array of CSS/SCSS file paths
 * @param {string} projectDir - Project directory
 * @returns {Object} Variable definitions found
 */
async function extractVariablesFromMatches(cssMatches, projectFiles, projectDir) {
    // Collect all variable usages from matched rules
    const cssVarsUsed = new Set();
    const scssVarsUsed = new Set();

    for (const match of cssMatches) {
        const content = match.content || '';

        // Extract CSS custom property usages
        const cssUsages = extractCSSVariableUsages(content);
        cssUsages.forEach(v => cssVarsUsed.add(v));

        // Extract SCSS variable usages
        const scssUsages = extractSCSSVariableUsages(content);
        scssUsages.forEach(v => scssVarsUsed.add(v));
    }

    if (cssVarsUsed.size === 0 && scssVarsUsed.size === 0) {
        return { cssVariables: {}, scssVariables: {}, usedVariables: [] };
    }

    // Search project files for definitions
    const allCSSDefinitions = {};
    const allSCSSDefinitions = {};

    const cssFiles = projectFiles.filter(f =>
        f.endsWith('.css') || f.endsWith('.scss') || f.endsWith('.sass')
    );

    for (const filePath of cssFiles) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const relPath = path.relative(projectDir, filePath);

            // Find CSS variable definitions
            if (cssVarsUsed.size > 0) {
                const defs = findCSSVariableDefinitions(content, cssVarsUsed);
                for (const [varName, defList] of Object.entries(defs)) {
                    if (!allCSSDefinitions[varName]) {
                        allCSSDefinitions[varName] = [];
                    }
                    defList.forEach(def => {
                        allCSSDefinitions[varName].push({
                            ...def,
                            file: relPath
                        });
                    });
                }
            }

            // Find SCSS variable definitions
            if (scssVarsUsed.size > 0 && (filePath.endsWith('.scss') || filePath.endsWith('.sass'))) {
                const defs = findSCSSVariableDefinitions(content, scssVarsUsed);
                for (const [varName, defList] of Object.entries(defs)) {
                    if (!allSCSSDefinitions[varName]) {
                        allSCSSDefinitions[varName] = [];
                    }
                    defList.forEach(def => {
                        allSCSSDefinitions[varName].push({
                            ...def,
                            file: relPath
                        });
                    });
                }
            }
        } catch (error) {
            // Skip files that can't be read
        }
    }

    // Find undefined variables (used but not found)
    const undefinedCSSVars = [...cssVarsUsed].filter(v => !allCSSDefinitions[v]);
    const undefinedSCSSVars = [...scssVarsUsed].filter(v => !allSCSSDefinitions[v]);

    return {
        cssVariables: allCSSDefinitions,
        scssVariables: allSCSSDefinitions,
        undefinedCSSVariables: undefinedCSSVars,
        undefinedSCSSVariables: undefinedSCSSVars,
        usedVariables: [...cssVarsUsed, ...scssVarsUsed]
    };
}

/**
 * Format variable definitions as markdown
 * @param {Object} variableData - Variable data from extractVariablesFromMatches
 * @returns {string} Markdown content
 */
function formatVariablesAsMarkdown(variableData) {
    const { cssVariables, scssVariables, undefinedCSSVariables, undefinedSCSSVariables } = variableData;

    let content = '';

    // CSS Variables
    const cssVarNames = Object.keys(cssVariables);
    if (cssVarNames.length > 0) {
        content += `### CSS Custom Properties Used\n\n`;
        content += `| Variable | Value | Context | File |\n`;
        content += `|----------|-------|---------|------|\n`;

        for (const varName of cssVarNames) {
            const defs = cssVariables[varName];
            // Show first definition (usually :root)
            const def = defs[0];
            const shortValue = def.value.length > 40 ? def.value.substring(0, 37) + '...' : def.value;
            content += `| \`${varName}\` | \`${shortValue}\` | ${def.context} | \`${def.file}\` |\n`;
        }
        content += '\n';
    }

    // SCSS Variables
    const scssVarNames = Object.keys(scssVariables);
    if (scssVarNames.length > 0) {
        content += `### SCSS Variables Used\n\n`;
        content += `\`\`\`scss\n`;
        for (const varName of scssVarNames) {
            const defs = scssVariables[varName];
            const def = defs[0];
            content += `${varName}: ${def.value};\n`;
        }
        content += `\`\`\`\n\n`;
    }

    // Undefined variables warning
    const allUndefined = [...(undefinedCSSVariables || []), ...(undefinedSCSSVariables || [])];
    if (allUndefined.length > 0) {
        content += `### ⚠️ Undefined Variables\n\n`;
        content += `The following variables are used but their definitions were not found:\n\n`;
        allUndefined.forEach(v => {
            content += `- \`${v}\`\n`;
        });
        content += `\n> These may be defined in a file not scanned, or loaded via a CSS framework.\n\n`;
    }

    return content;
}

module.exports = {
    extractCSSVariableUsages,
    extractSCSSVariableUsages,
    findCSSVariableDefinitions,
    findSCSSVariableDefinitions,
    extractVariablesFromMatches,
    formatVariablesAsMarkdown
};
