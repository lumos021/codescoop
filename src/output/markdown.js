/**
 * Markdown Output Generator
 * Generates LLM-ready markdown report from analysis results
 */

const path = require('path');
const { formatVariablesAsMarkdown } = require('../utils/variable-extractor');
const { detectGhostClasses, formatGhostClassesMarkdown } = require('../utils/ghost-detector');
const { analyzeConflicts, formatConflictsMarkdown } = require('../utils/specificity-calculator');

/**
 * Generate markdown report from analysis
 * @param {Object} analysis - Analysis results
 * @returns {string} Markdown content
 */
function generateMarkdown(analysis) {
    const {
        targetInfo,
        htmlPath,
        projectDir,
        cssResults,
        jsResults,
        cssLibraryResults = [],
        jsLibraryResults = [],
        detectedLibraries = {},
        inlineStyles,
        inlineScripts,
        missingImports,
        variableData = {},
        htmlAssets = {},
        assetStatus = {},
        generatedAt,
        outputOptions = {}
    } = analysis;

    // Extract output options with defaults
    const {
        compact = false,
        forConversion = false,
        maxRulesPerFile = compact ? 20 : Infinity,
        maxJsPerFile = compact ? 10 : Infinity,
        summaryOnly = false,
        skipMinified = false
    } = outputOptions;

    // If forConversion mode, use specialized conversion context generator
    if (forConversion) {
        const { generateConversionContext } = require('./conversion-generator');
        return generateConversionContext(analysis);
    }

    // Apply filters based on options
    let filteredCssResults = cssResults;
    let filteredJsResults = jsResults;

    if (skipMinified) {
        filteredCssResults = cssResults.filter(r => !r.isMinified);
        filteredJsResults = jsResults.filter(r => !r.isMinified);
    }

    // Apply limits per file
    if (compact || maxRulesPerFile < Infinity) {
        filteredCssResults = filteredCssResults.map(r => ({
            ...r,
            matches: r.matches.slice(0, maxRulesPerFile),
            truncated: r.matches.length > maxRulesPerFile,
            originalCount: r.matches.length
        }));
    }

    if (compact || maxJsPerFile < Infinity) {
        filteredJsResults = filteredJsResults.map(r => ({
            ...r,
            matches: r.matches.slice(0, maxJsPerFile),
            truncated: r.matches.length > maxJsPerFile,
            originalCount: r.matches.length
        }));
    }

    const sections = [];

    // Header
    sections.push(generateHeader(targetInfo, htmlPath, generatedAt, compact));

    // Libraries section (NEW!)
    const hasLibraries =
        Object.keys(detectedLibraries.fromFiles || {}).length > 0 ||
        (detectedLibraries.fromCDN || []).length > 0 ||
        (detectedLibraries.fromClasses || []).length > 0;

    if (hasLibraries) {
        sections.push(generateLibrariesSection(detectedLibraries, cssLibraryResults, jsLibraryResults, projectDir));
    }

    // Missing imports warning (if any)
    if (missingImports.length > 0) {
        sections.push(generateMissingImportsWarning(missingImports, projectDir));
    }

    // In summary-only mode, skip detailed code blocks
    if (summaryOnly) {
        sections.push(generateSummaryOnlySection(filteredCssResults, filteredJsResults, projectDir));
        sections.push(generateSummary(cssResults, jsResults, inlineStyles, inlineScripts, missingImports, detectedLibraries));
        return sections.join('\n\n---\n\n');
    }

    // Target HTML
    sections.push(generateHTMLSection(targetInfo));

    // CSS/SCSS Variables section
    if (variableData && variableData.usedVariables && variableData.usedVariables.length > 0) {
        const varsSection = `## 🎨 CSS/SCSS Variables\n\n> These variables are used in the matched CSS rules. Definitions are included for context.\n\n${formatVariablesAsMarkdown(variableData)}`;
        sections.push(varsSection);
    }

    // CSS Houdini @property definitions
    const houdiniSection = generateHoudiniSection(cssResults, projectDir);
    if (houdiniSection) {
        sections.push(houdiniSection);
    }

    // Assets & Resources
    const assetsSection = generateAssetsSection(htmlAssets, assetStatus);
    if (assetsSection) {
        sections.push(assetsSection);
    }

    // CSS Dependencies (custom code only)
    const linkedCSS = filteredCssResults.filter(r => r.isLinked);
    const unlinkedCSS = filteredCssResults.filter(r => !r.isLinked);

    if (linkedCSS.length > 0 || inlineStyles.length > 0) {
        sections.push(generateCSSSection(linkedCSS, inlineStyles, projectDir, 'Custom CSS Dependencies', compact));
    }

    if (unlinkedCSS.length > 0) {
        sections.push(generateCSSSection(unlinkedCSS, [], projectDir, '⚠️ Custom CSS Files NOT Linked', compact));
    }

    // Shadow DOM styles
    const shadowDOMSection = generateShadowDOMSection(cssResults, projectDir);
    if (shadowDOMSection) {
        sections.push(shadowDOMSection);
    }

    // JavaScript References (custom code only)
    const linkedJS = filteredJsResults.filter(r => r.isLinked);
    const unlinkedJS = filteredJsResults.filter(r => !r.isLinked);

    if (linkedJS.length > 0 || inlineScripts.length > 0) {
        sections.push(generateJSSection(linkedJS, inlineScripts, projectDir, 'Custom JavaScript References', compact));
    }

    if (unlinkedJS.length > 0) {
        sections.push(generateJSSection(unlinkedJS, [], projectDir, '⚠️ Custom JS Files NOT Linked', compact));
    }

    // CSS Conflict Detection (specificity analysis)
    const conflicts = analyzeConflicts(cssResults, { css: cssResults.filter(r => r.isLinked).map(r => r.file) });
    const conflictsMarkdown = formatConflictsMarkdown(conflicts);
    if (conflictsMarkdown) {
        sections.push(conflictsMarkdown);
    }

    // Ghost Classes Detection
    const ghostData = detectGhostClasses(targetInfo, cssResults, cssLibraryResults, inlineStyles);
    if (ghostData.hasGhosts) {
        sections.push(formatGhostClassesMarkdown(ghostData));
    }

    // Summary
    sections.push(generateSummary(cssResults, jsResults, inlineStyles, inlineScripts, missingImports, detectedLibraries, ghostData));

    return sections.join('\n\n---\n\n');
}

/**
 * Generate libraries section
 */
function generateLibrariesSection(detectedLibraries, cssLibraryResults, jsLibraryResults, projectDir) {
    let content = `## 📚 Libraries Detected\n\n`;
    content += `> These libraries are used by this component. Make sure they are properly imported.\n\n`;

    // Libraries from CDN
    const cdnLibs = detectedLibraries.fromCDN || [];
    if (cdnLibs.length > 0) {
        content += `### Loaded via CDN ✅\n\n`;
        content += `| Library | Type | URL |\n`;
        content += `|---------|------|-----|\n`;
        cdnLibs.forEach(lib => {
            const shortUrl = lib.url.length > 50 ? lib.url.substring(0, 47) + '...' : lib.url;
            content += `| **${lib.name}** | ${lib.type} | \`${shortUrl}\` |\n`;
        });
        content += '\n';
    }

    // Libraries from local files
    const fileLibs = detectedLibraries.fromFiles || {};
    const libNames = Object.keys(fileLibs);
    if (libNames.length > 0) {
        content += `### Local Library Files\n\n`;
        content += `| Library | Type | Status | Website |\n`;
        content += `|---------|------|--------|--------|\n`;

        libNames.forEach(name => {
            const lib = fileLibs[name];
            const hasLinkedFiles = lib.files?.some(f => {
                const allResults = [...cssLibraryResults, ...jsLibraryResults];
                return allResults.find(r => r.filePath === f && r.isLinked);
            });
            const status = hasLinkedFiles ? '✅ Linked' : '⚠️ Not Linked';
            const website = lib.website ? `[Docs](${lib.website})` : '-';
            content += `| **${name}** | ${lib.type} | ${status} | ${website} |\n`;
        });
        content += '\n';
    }

    // Libraries detected from class names
    const classLibs = detectedLibraries.fromClasses || [];
    if (classLibs.length > 0) {
        content += `### Detected from Class Names\n\n`;
        content += `The following libraries appear to be used based on class naming conventions:\n\n`;
        classLibs.forEach(name => {
            content += `- **${name}**\n`;
        });
        content += '\n';
    }

    // Note about library code
    content += `> **Note:** Library code is not shown in detail below to keep the report focused on your custom code.\n`;
    content += `> The component uses ${cssLibraryResults.length} CSS rules and ${jsLibraryResults.length} JS references from libraries.`;

    return content;
}

/**
 * Generate header section
 */
function generateHeader(targetInfo, htmlPath, generatedAt) {
    const date = new Date(generatedAt).toLocaleString();

    return `# Component Analysis: ${targetInfo.selector}

> Generated by **CodeScoop** on ${date}
> 
> Source: \`${path.basename(htmlPath)}\`

## Target Component

| Property | Value |
|----------|-------|
| **Selector** | \`${targetInfo.selector}\` |
| **Tag** | \`<${targetInfo.tagName}>\` |
| **Classes** | ${targetInfo.classes.length > 0 ? targetInfo.classes.map(c => '`.' + c + '`').join(', ') : '_none_'} |
| **IDs** | ${targetInfo.ids.length > 0 ? targetInfo.ids.map(id => '`#' + id + '`').join(', ') : '_none_'} |
| **Line Range** | ${targetInfo.startLine ? `Lines ${targetInfo.startLine}-${targetInfo.endLine}` : '_unknown_'} |`;
}

/**
 * Generate missing imports warning
 */
function generateMissingImportsWarning(missingImports, projectDir) {
    const fileList = missingImports.map(f => `- \`${path.relative(projectDir, f)}\``).join('\n');

    return `## ⚠️ Missing Imports Detected

The following files contain code relevant to this component but are **NOT imported** in the HTML file:

${fileList}

> **This may cause the component to not work correctly!**
> Add the appropriate \`<link>\` or \`<script>\` tags to import these files.`;
}

/**
 * Generate HTML section
 */
function generateHTMLSection(targetInfo) {
    return `## Target HTML
${targetInfo.startLine ? `**Lines:** ${targetInfo.startLine}-${targetInfo.endLine}` : ''}

\`\`\`html
${targetInfo.html}
\`\`\``;
}

/**
 * Generate CSS section
 */
function generateCSSSection(cssResults, inlineStyles, projectDir, title) {
    let content = `## ${title}\n\n`;

    // Inline styles first
    if (inlineStyles.length > 0) {
        content += `### Inline \`<style>\` Blocks\n\n`;

        inlineStyles.forEach((style, index) => {
            content += `#### Block ${index + 1}\n\n`;
            content += '```css\n' + style.content + '\n```\n\n';
        });
    }

    // External CSS files
    cssResults.forEach(result => {
        const relativePath = path.relative(projectDir, result.filePath);
        const fileType = result.isScss ? 'SCSS' : (result.isMinified ? 'CSS (minified)' : 'CSS');

        content += `### From: \`${relativePath}\`\n`;
        content += `**Type:** ${fileType}\n\n`;

        result.matches.forEach((match, index) => {
            if (match.atRuleContext) {
                content += `**Context:** \`${match.atRuleContext}\`\n`;
            }

            content += `**Lines:** ${match.startLine}-${match.endLine} | `;
            content += `**Matched on:** ${match.matchedOn.join(', ')}\n\n`;

            const lang = result.isScss ? 'scss' : 'css';
            content += '```' + lang + '\n' + match.content + '\n```\n\n';
        });
    });

    return content;
}

/**
 * Generate JavaScript section
 */
function generateJSSection(jsResults, inlineScripts, projectDir, title) {
    let content = `## ${title}\n\n`;

    // Inline scripts first
    if (inlineScripts.length > 0) {
        content += `### Inline \`<script>\` Blocks\n\n`;

        inlineScripts.forEach((script, index) => {
            content += `#### Block ${index + 1}\n\n`;
            content += '```javascript\n' + script.content + '\n```\n\n';
        });
    }

    // External JS files
    jsResults.forEach(result => {
        const relativePath = path.relative(projectDir, result.filePath);
        const fileType = result.isMinified ? 'JS (minified, beautified for display)' : 'JavaScript';

        content += `### From: \`${relativePath}\`\n`;
        content += `**Type:** ${fileType}\n\n`;

        result.matches.forEach((match, index) => {
            content += `**Lines:** ${match.startLine}-${match.endLine} | `;
            content += `**Type:** ${match.type} | `;
            content += `**Matched on:** ${match.matchedOn.join(', ')}\n`;

            if (match.selector) {
                content += `**Selector:** \`${match.selector}\`\n`;
            }

            content += '\n```javascript\n' + match.content + '\n```\n\n';
        });
    });

    return content;
}

/**
 * Generate summary section
 */
function generateSummary(cssResults, jsResults, inlineStyles, inlineScripts, missingImports, detectedLibraries = {}, ghostData = {}) {
    const totalCSSRules = cssResults.reduce((sum, r) => sum + r.matches.length, 0) + inlineStyles.length;
    const totalJSRefs = jsResults.reduce((sum, r) => sum + r.matches.length, 0) + inlineScripts.length;

    const linkedCSSFiles = cssResults.filter(r => r.isLinked).length;
    const linkedJSFiles = jsResults.filter(r => r.isLinked).length;
    const unlinkedCSSFiles = cssResults.filter(r => !r.isLinked).length;
    const unlinkedJSFiles = jsResults.filter(r => !r.isLinked).length;

    const libraryCount = Object.keys(detectedLibraries.fromFiles || {}).length +
        (detectedLibraries.fromCDN || []).length;

    const ghostCount = ghostData.ghostClasses?.length || 0;

    const advancedFeaturesSummary = updateSummaryForAdvancedFeatures(cssResults);

    return `## Summary

| Metric | Count |
|--------|-------|
| **Libraries Detected** | ${libraryCount} |
| **Custom CSS Rules Found** | ${totalCSSRules} |
| **Custom JS References Found** | ${totalJSRefs} |
| **Linked CSS Files** | ${linkedCSSFiles} |
| **Linked JS Files** | ${linkedJSFiles} |
| **Unlinked CSS Files (potential issues)** | ${unlinkedCSSFiles} |
| **Unlinked JS Files (potential issues)** | ${unlinkedJSFiles} |
| **Inline Styles** | ${inlineStyles.length} |
| **Inline Scripts** | ${inlineScripts.length} |
${ghostCount > 0 ? `| **👻 Ghost Classes (no CSS)** | ${ghostCount} |\n` : ''}${advancedFeaturesSummary}
${missingImports.length > 0 ? `
### ⚠️ Action Required
${missingImports.length} file(s) contain relevant code but are not imported. Review the "Missing Imports" section above.
` : '✅ All custom files with relevant code appear to be properly linked.'}

---

*This report was generated by CodeScoop to help debug component dependencies. Feed this file to an LLM for assistance converting to React/Next.js or debugging issues.*`;
}

/**
 * Generate summary-only section (no code blocks)
 */
function generateSummaryOnlySection(cssResults, jsResults, projectDir) {
    let content = `## 📋 Files Summary (Summary-Only Mode)\n\n`;
    content += `> Code blocks omitted. Use without \`--summary-only\` flag to see full code.\n\n`;

    // CSS Files
    const cssWithMatches = cssResults.filter(r => r.matches && r.matches.length > 0);
    if (cssWithMatches.length > 0) {
        content += `### CSS Files (${cssWithMatches.length} files)\n\n`;
        content += `| File | Matches | Linked |\n`;
        content += `|------|---------|--------|\n`;
        cssWithMatches.forEach(result => {
            const relPath = path.relative(projectDir, result.filePath);
            const count = result.originalCount || result.matches.length;
            const linked = result.isLinked ? '✅' : '❌';
            content += `| \`${relPath}\` | ${count} rules | ${linked} |\n`;
        });
        content += '\n';
    }

    // JS Files
    const jsWithMatches = jsResults.filter(r => r.matches && r.matches.length > 0);
    if (jsWithMatches.length > 0) {
        content += `### JavaScript Files (${jsWithMatches.length} files)\n\n`;
        content += `| File | Matches | Linked |\n`;
        content += `|------|---------|--------|\n`;
        jsWithMatches.forEach(result => {
            const relPath = path.relative(projectDir, result.filePath);
            const count = result.originalCount || result.matches.length;
            const linked = result.isLinked ? '✅' : '❌';
            content += `| \`${relPath}\` | ${count} refs | ${linked} |\n`;
        });
        content += '\n';
    }

    return content;
}

/**
 * Generate Shadow DOM section (add to generateMarkdown after CSS section)
 */
function generateShadowDOMSection(cssResults, projectDir) {
    // Collect all Shadow DOM rules from all CSS results
    const allShadowDOMRules = [];

    for (const result of cssResults) {
        if (result.shadowDOMRules && result.shadowDOMRules.length > 0) {
            allShadowDOMRules.push({
                file: result.filePath,
                rules: result.shadowDOMRules
            });
        }
    }

    if (allShadowDOMRules.length === 0) {
        return '';
    }

    let content = `## 🔮 Shadow DOM Styles\n\n`;
    content += `> These styles target Web Component shadow DOM via \`::part()\` or \`::slotted()\`.\n`;
    content += `> Shadow DOM provides style encapsulation for custom elements.\n\n`;

    for (const { file, rules } of allShadowDOMRules) {
        const relativePath = path.relative(projectDir, file);
        content += `### From: \`${relativePath}\`\n\n`;

        for (const rule of rules) {
            if (rule.atRuleContext) {
                content += `**Context:** \`${rule.atRuleContext}\`\n`;
            }

            content += `**Type:** \`${rule.shadowDOMType}\` | `;
            content += `**Lines:** ${rule.startLine}-${rule.endLine} | `;
            content += `**Matched on:** ${rule.matchedOn.join(', ')}\n\n`;

            content += '```css\n' + rule.content + '\n```\n\n';
        }
    }

    content += `> **Note:** Shadow DOM styles are isolated from global styles. `;
    content += `\`::part()\` exposes specific shadow DOM elements for styling from outside.\n`;

    return content;
}

/**
 * Generate CSS Houdini section (add to generateMarkdown after variables section)
 */
function generateHoudiniSection(cssResults, projectDir) {
    // Collect all Houdini properties
    const allHoudiniProps = [];

    for (const result of cssResults) {
        if (result.houdiniProperties && result.houdiniProperties.length > 0) {
            allHoudiniProps.push({
                file: result.filePath,
                properties: result.houdiniProperties
            });
        }
    }

    if (allHoudiniProps.length === 0) {
        return '';
    }

    let content = `## 🎨 CSS Houdini Custom Properties\n\n`;
    content += `> CSS Houdini \`@property\` rules define custom properties with type checking and default values.\n`;
    content += `> These provide more control than standard CSS variables.\n\n`;

    for (const { file, properties } of allHoudiniProps) {
        const relativePath = path.relative(projectDir, file);
        content += `### From: \`${relativePath}\`\n\n`;

        for (const prop of properties) {
            if (prop.atRuleContext) {
                content += `**Context:** \`${prop.atRuleContext}\`\n`;
            }

            content += `**Property:** \`${prop.propertyName}\` | `;
            content += `**Lines:** ${prop.startLine}-${prop.endLine}\n\n`;

            content += '```css\n' + prop.content + '\n```\n\n';
        }
    }

    content += `> **Browser Support:** CSS Houdini has limited support. Check [caniuse.com](https://caniuse.com/css-properties-and-values-api) for compatibility.\n`;

    return content;
}

/**
 * Add to your summary section to track Shadow DOM and Houdini usage
 */
function updateSummaryForAdvancedFeatures(cssResults) {
    const shadowDOMCount = cssResults.reduce((sum, r) =>
        sum + (r.shadowDOMRules?.length || 0), 0);

    const houdiniCount = cssResults.reduce((sum, r) =>
        sum + (r.houdiniProperties?.length || 0), 0);

    let summaryAddition = '';

    if (shadowDOMCount > 0) {
        summaryAddition += `| **Shadow DOM Rules** | ${shadowDOMCount} |\n`;
    }

    if (houdiniCount > 0) {
        summaryAddition += `| **Houdini @property Rules** | ${houdiniCount} |\n`;
    }

    return summaryAddition;
}

/**
 * Generate Assets & Resources section
 */
function generateAssetsSection(htmlAssets, assetStatus) {
    const { details = [] } = assetStatus;

    if (details.length === 0) {
        return null; // No assets to report
    }

    let content = `## Assets & Resources\n\n`;

    // Summary
    content += `> **Total:** ${assetStatus.total} | `;
    content += `**Available:** ${assetStatus.available} | `;
    content += `**Missing:** ${assetStatus.missing} | `;
    content += `**External:** ${assetStatus.external} | `;
    content += `**Embedded:** ${assetStatus.embedded}\n\n`;

    // Group by category
    const images = details.filter(a => a.type.includes('img') || a.type.includes('background') || a.type.includes('poster'));
    const videos = details.filter(a => a.type.includes('video') && !a.type.includes('poster'));
    const audio = details.filter(a => a.type.includes('audio'));
    const fonts = details.filter(a => a.type.includes('font'));
    const icons = details.filter(a => a.type === 'icon');
    const canvas = htmlAssets.canvas || [];
    const svgs = htmlAssets.svgs || [];

    // Images
    if (images.length > 0) {
        content += `### Images (${images.length})\n\n`;
        content += `| Path | Type | Status | Size | Location |\n`;
        content += `|------|------|--------|------|----------|\n`;

        images.forEach(img => {
            const status = img.status === 'OK' ? 'OK' :
                img.status === 'EMBEDDED' ? 'Embedded' :
                    img.status === 'EXTERNAL' ? 'External' :
                        '**NOT FOUND**';
            const size = img.sizeFormatted || '-';
            const location = img.location || 'HTML';
            content += `| \`${img.src}\` | ${img.type} | ${status} | ${size} | ${location} |\n`;
        });
        content += `\n`;
    }

    // Videos
    if (videos.length > 0) {
        content += `### Videos (${videos.length})\n\n`;
        videos.forEach(vid => {
            const status = vid.status === 'OK' ? 'OK' : vid.status === 'EXTERNAL' ? 'External' : '**NOT FOUND**';
            content += `- \`${vid.src}\` - ${status}`;
            if (vid.sizeFormatted) content += ` (${vid.sizeFormatted})`;
            content += `\n`;
        });
        content += `\n`;
    }

    // Audio
    if (audio.length > 0) {
        content += `### Audio (${audio.length})\n\n`;
        audio.forEach(aud => {
            const status = aud.status === 'OK' ? 'OK' : aud.status === 'EXTERNAL' ? 'External' : '**NOT FOUND**';
            content += `- \`${aud.src}\` - ${status}\n`;
        });
        content += `\n`;
    }

    // Fonts
    if (fonts.length > 0) {
        content += `### Fonts (${fonts.length})\n\n`;
        fonts.forEach(font => {
            const status = font.status === 'OK' ? 'OK' : font.status === 'EXTERNAL' ? 'External' : '**NOT FOUND**';
            content += `- \`${font.src}\` - ${status}`;
            if (font.sizeFormatted) content += ` (${font.sizeFormatted})`;
            content += `\n`;
        });
        content += `\n`;
    }

    // Icons
    if (icons.length > 0) {
        content += `### Icons (${icons.length})\n\n`;
        icons.forEach(icon => {
            content += `- \`${icon.src}\` (${icon.rel || 'icon'})\n`;
        });
        content += `\n`;
    }

    // Canvas (for WebGL/3D context)
    if (canvas.length > 0) {
        content += `### Canvas Elements (${canvas.length})\n\n`;
        content += `> **Note:** Canvas elements may be used for WebGL/3D rendering. LLM can infer library (Three.js, Babylon.js) from associated JavaScript.\n\n`;
        canvas.forEach(c => {
            content += `- ID: \`${c.id}\` | Size: ${c.width} x ${c.height}\n`;
        });
        content += `\n`;
    }

    // SVG
    if (svgs.length > 0) {
        content += `### Inline SVG (${svgs.length})\n\n`;
        content += `> Inline SVG graphics detected. Full SVG code is included in the HTML section.\n\n`;
        svgs.forEach(s => {
            content += `- ID: \`${s.id}\``;
            if (s.viewBox) content += ` | ViewBox: ${s.viewBox}`;
            content += `\n`;
        });
        content += `\n`;
    }

    // Missing assets warning
    if (assetStatus.missing > 0) {
        content += `> **Warning:** ${assetStatus.missing} asset(s) are missing. These may cause broken images or functionality.\n\n`;
    }

    return content;
}

module.exports = {
    generateMarkdown,
    generateShadowDOMSection,
    generateHoudiniSection,
    updateSummaryForAdvancedFeatures,
    generateAssetsSection
};
