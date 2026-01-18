/**
 * CSS Specificity Calculator
 * Uses the battle-tested 'specificity' npm library to calculate specificity
 * and predict which CSS rules will actually render
 */

const { calculate } = require('specificity');

/**
 * Calculate specificity for a CSS selector using the npm library
 * Returns [inline, ids, classes, elements] tuple
 * @param {string} selector - CSS selector
 * @returns {number[]} Specificity tuple [inline, ids, classes, elements]
 */
function calculateSpecificity(selector) {
    if (!selector || typeof selector !== 'string') {
        return [0, 0, 0, 0];
    }

    try {
        const result = calculate(selector);
        if (result) {
            // Library returns { A: ids, B: classes, C: elements }
            // We add inline (0) as the first element for consistency
            return [0, result.A || 0, result.B || 0, result.C || 0];
        }
    } catch (error) {
        // If the library can't parse it, return zeroes
        // console.warn(`Could not calculate specificity for "${selector}": ${error.message}`);
    }

    return [0, 0, 0, 0];
}

/**
 * Compare two specificity tuples
 * @param {number[]} a - First specificity
 * @param {number[]} b - Second specificity
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 */
function compareSpecificity(a, b) {
    for (let i = 0; i < 4; i++) {
        if (a[i] > b[i]) return 1;
        if (a[i] < b[i]) return -1;
    }
    return 0;
}

/**
 * Format specificity as readable string
 * @param {number[]} spec - Specificity tuple
 * @returns {string} Formatted string like "(0,1,2,3)"
 */
function formatSpecificity(spec) {
    return `(${spec.join(',')})`;
}

/**
 * Check if a CSS value has !important
 * @param {string} value - CSS property value
 * @returns {boolean}
 */
function hasImportant(value) {
    return typeof value === 'string' && value.includes('!important');
}

/**
 * Analyze CSS rules and predict which ones will render
 * @param {Array} cssResults - CSS analysis results from the tool
 * @param {Object} linkedFiles - Information about linked CSS files
 * @returns {Object} Conflict analysis with winners/losers
 */
function analyzeConflicts(cssResults, linkedFiles = { css: [] }) {
    // Group rules by property
    const propertyRules = {};

    // Track file order (later = higher priority for same specificity)
    const fileOrder = {};
    linkedFiles.css.forEach((file, index) => {
        fileOrder[file] = index;
    });

    let globalOrder = 0;

    for (const result of cssResults) {
        const filePath = result.filePath || result.file;
        const fileOrderValue = fileOrder[filePath] ?? 999;

        for (const match of result.matches || []) {
            const selector = match.selector || '';
            const specificity = calculateSpecificity(selector);
            const content = match.content || '';

            // Parse properties from content
            const properties = parseProperties(content);

            for (const [prop, value] of Object.entries(properties)) {
                if (!propertyRules[prop]) {
                    propertyRules[prop] = [];
                }

                propertyRules[prop].push({
                    selector,
                    specificity,
                    value,
                    hasImportant: hasImportant(value),
                    file: filePath,
                    fileOrder: fileOrderValue,
                    globalOrder: globalOrder++,
                    startLine: match.startLine,
                    endLine: match.endLine
                });
            }
        }
    }

    // Determine winner for each property
    const conflicts = {};

    for (const [prop, rules] of Object.entries(propertyRules)) {
        if (rules.length <= 1) {
            continue; // No conflict
        }

        // Sort by priority: !important > specificity > file order > declaration order
        const sorted = [...rules].sort((a, b) => {
            // !important always wins
            if (a.hasImportant && !b.hasImportant) return 1;
            if (!a.hasImportant && b.hasImportant) return -1;

            // Compare specificity
            const specCompare = compareSpecificity(a.specificity, b.specificity);
            if (specCompare !== 0) return specCompare;

            // Same specificity: later file wins
            if (a.fileOrder !== b.fileOrder) return a.fileOrder - b.fileOrder;

            // Same file: later declaration wins
            return a.globalOrder - b.globalOrder;
        });

        const winner = sorted[sorted.length - 1];
        const losers = sorted.slice(0, -1);

        conflicts[prop] = {
            winner,
            losers,
            hasConflict: losers.length > 0
        };
    }

    return conflicts;
}

/**
 * Parse CSS properties from a rule content
 * @param {string} content - CSS rule content
 * @returns {Object} Property-value pairs
 */
function parseProperties(content) {
    const properties = {};

    // Remove selector and braces if present
    let body = content;
    const braceMatch = content.match(/\{([^}]+)\}/);
    if (braceMatch) {
        body = braceMatch[1];
    }

    // Split by semicolons and parse
    const declarations = body.split(';');
    for (const decl of declarations) {
        const colonIndex = decl.indexOf(':');
        if (colonIndex > 0) {
            const prop = decl.substring(0, colonIndex).trim();
            const value = decl.substring(colonIndex + 1).trim();
            if (prop && value) {
                properties[prop] = value;
            }
        }
    }

    return properties;
}

/**
 * Format conflict analysis as markdown
 * @param {Object} conflicts - Conflict analysis from analyzeConflicts
 * @returns {string} Markdown formatted output
 */
function formatConflictsMarkdown(conflicts) {
    const conflictingProps = Object.entries(conflicts).filter(([_, data]) => data.hasConflict);

    if (conflictingProps.length === 0) {
        return '';
    }

    let md = `\n---\n\n## ⚔️ CSS Conflicts Detected\n\n`;
    md += `> Multiple CSS rules are competing for the same properties. Here's what will actually render:\n`;
    md += `> *Note: Rules are sorted by specificity. If equal, the browser uses the rule loaded last.*\n\n`;

    for (const [prop, data] of conflictingProps) {
        const { winner, losers } = data;

        md += `### \`${prop}\`\n\n`;
        md += `| Status | File | Selector | Value | Specificity |\n`;
        md += `|--------|------|----------|-------|-------------|\n`;

        // Show winner first
        md += `| ✅ **Winner** | \`${getFileName(winner.file)}\` | \`${winner.selector}\` | \`${truncateValue(winner.value)}\` | ${formatSpecificity(winner.specificity)}${winner.hasImportant ? ' **!important**' : ''} |\n`;

        // Show losers
        for (const loser of losers.reverse()) {
            md += `| ❌ Overridden | \`${getFileName(loser.file)}\` | \`${loser.selector}\` | \`${truncateValue(loser.value)}\` | ${formatSpecificity(loser.specificity)}${loser.hasImportant ? ' !important' : ''} |\n`;
        }

        md += '\n';
    }

    md += `**${conflictingProps.length}** property conflict(s) detected.\n`;

    return md;
}

/**
 * Truncate long CSS values for display
 */
function truncateValue(value) {
    if (!value) return '';
    if (value.length > 40) {
        return value.substring(0, 37) + '...';
    }
    return value;
}

/**
 * Get just the filename from a path
 */
function getFileName(filePath) {
    if (!filePath) return 'unknown';
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
}

module.exports = {
    calculateSpecificity,
    compareSpecificity,
    formatSpecificity,
    analyzeConflicts,
    formatConflictsMarkdown
};
