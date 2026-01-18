/**
 * LLM Conversion Context Generator
 * Generates structured output optimized for LLM-assisted React/Next.js conversion
 */

const path = require('path');

/**
 * Analyze jQuery/vanilla JS patterns and suggest React equivalents
 * @param {Array} jsMatches - JS matches from analysis
 * @returns {Object} Detected patterns and suggestions
 */
function analyzeJSPatterns(jsMatches) {
    const patterns = {
        stateNeeded: [],
        eventHandlers: [],
        effects: [],
        animations: [],
        apiCalls: [],
        domManipulations: []
    };

    const allContent = jsMatches.map(m => m.content || '').join('\n');

    // Detect jQuery patterns
    const jqueryPatterns = [
        { regex: /\$\(['"]([\.\#][^'"]+)['"]\)\.click/g, type: 'event', event: 'onClick' },
        { regex: /\$\(['"]([\.\#][^'"]+)['"]\)\.on\(['"]click/g, type: 'event', event: 'onClick' },
        { regex: /\$\(['"]([\.\#][^'"]+)['"]\)\.hover/g, type: 'event', event: 'onMouseEnter/onMouseLeave' },
        { regex: /\$\(['"]([\.\#][^'"]+)['"]\)\.submit/g, type: 'event', event: 'onSubmit' },
        { regex: /\$\(['"]([\.\#][^'"]+)['"]\)\.change/g, type: 'event', event: 'onChange' },
        { regex: /\$\(['"]([\.\#][^'"]+)['"]\)\.keyup/g, type: 'event', event: 'onKeyUp' },
        { regex: /\$\(['"]([\.\#][^'"]+)['"]\)\.keydown/g, type: 'event', event: 'onKeyDown' },
        { regex: /\.addClass\(['"]([^'"]+)['"]\)/g, type: 'state', name: 'classToggle' },
        { regex: /\.removeClass\(['"]([^'"]+)['"]\)/g, type: 'state', name: 'classToggle' },
        { regex: /\.toggleClass\(['"]([^'"]+)['"]\)/g, type: 'state', name: 'classToggle' },
        { regex: /\.show\(\)/g, type: 'state', name: 'isVisible' },
        { regex: /\.hide\(\)/g, type: 'state', name: 'isVisible' },
        { regex: /\.toggle\(\)/g, type: 'state', name: 'isVisible' },
        { regex: /\.slideToggle/g, type: 'animation', name: 'slideToggle', suggestion: 'framer-motion or CSS transitions' },
        { regex: /\.slideDown/g, type: 'animation', name: 'slideDown', suggestion: 'framer-motion AnimatePresence' },
        { regex: /\.slideUp/g, type: 'animation', name: 'slideUp', suggestion: 'framer-motion AnimatePresence' },
        { regex: /\.fadeIn/g, type: 'animation', name: 'fadeIn', suggestion: 'framer-motion or CSS transitions' },
        { regex: /\.fadeOut/g, type: 'animation', name: 'fadeOut', suggestion: 'framer-motion or CSS transitions' },
        { regex: /\.animate\(/g, type: 'animation', name: 'custom', suggestion: 'framer-motion or GSAP' },
        { regex: /\$\.ajax\(/g, type: 'api', suggestion: 'fetch + useEffect or React Query' },
        { regex: /\$\.get\(/g, type: 'api', suggestion: 'fetch + useEffect' },
        { regex: /\$\.post\(/g, type: 'api', suggestion: 'fetch + useEffect' },
        { regex: /\.html\(/g, type: 'dom', warning: 'Use dangerouslySetInnerHTML or restructure' },
        { regex: /\.text\(/g, type: 'dom', suggestion: 'Use state + JSX interpolation' },
        { regex: /\.val\(/g, type: 'state', name: 'inputValue', suggestion: 'Controlled input with useState' },
        { regex: /\.attr\(/g, type: 'dom', suggestion: 'Use props or state' },
        { regex: /\.css\(/g, type: 'dom', suggestion: 'Use inline styles or CSS modules' },
        { regex: /\.append\(/g, type: 'dom', warning: 'Restructure as state-driven rendering' },
        { regex: /\.prepend\(/g, type: 'dom', warning: 'Restructure as state-driven rendering' },
        { regex: /\.remove\(/g, type: 'dom', warning: 'Use conditional rendering' },
    ];

    // Vanilla JS patterns
    const vanillaPatterns = [
        { regex: /addEventListener\(['"]click['"]/g, type: 'event', event: 'onClick' },
        { regex: /addEventListener\(['"]submit['"]/g, type: 'event', event: 'onSubmit' },
        { regex: /addEventListener\(['"]change['"]/g, type: 'event', event: 'onChange' },
        { regex: /addEventListener\(['"]keyup['"]/g, type: 'event', event: 'onKeyUp' },
        { regex: /addEventListener\(['"]scroll['"]/g, type: 'effect', suggestion: 'useEffect with scroll listener' },
        { regex: /addEventListener\(['"]resize['"]/g, type: 'effect', suggestion: 'useEffect with resize listener or useWindowSize hook' },
        { regex: /classList\.add\(/g, type: 'state', name: 'classToggle' },
        { regex: /classList\.remove\(/g, type: 'state', name: 'classToggle' },
        { regex: /classList\.toggle\(/g, type: 'state', name: 'classToggle' },
        { regex: /\.style\./g, type: 'dom', suggestion: 'Use inline styles object or CSS modules' },
        { regex: /innerHTML/g, type: 'dom', warning: 'Avoid - use JSX or dangerouslySetInnerHTML' },
        { regex: /textContent/g, type: 'dom', suggestion: 'Use state + JSX' },
        { regex: /fetch\(/g, type: 'api', suggestion: 'Keep fetch, wrap in useEffect or use React Query' },
    ];

    // GSAP patterns
    const gsapPatterns = [
        { regex: /gsap\.to\(/g, type: 'animation', name: 'gsap.to', suggestion: 'Use @gsap/react useGSAP hook' },
        { regex: /gsap\.from\(/g, type: 'animation', name: 'gsap.from', suggestion: 'Use @gsap/react useGSAP hook' },
        { regex: /gsap\.fromTo\(/g, type: 'animation', name: 'gsap.fromTo', suggestion: 'Use @gsap/react useGSAP hook' },
        { regex: /gsap\.timeline\(/g, type: 'animation', name: 'gsap.timeline', suggestion: 'Use @gsap/react useGSAP hook' },
        { regex: /ScrollTrigger/g, type: 'animation', name: 'ScrollTrigger', suggestion: 'Use GSAP ScrollTrigger with useGSAP' },
    ];

    // Three.js patterns
    const threePatterns = [
        { regex: /THREE\.Scene/g, type: 'library', name: 'Three.js', suggestion: 'Use @react-three/fiber Canvas component' },
        { regex: /THREE\.WebGLRenderer/g, type: 'library', name: 'Three.js', suggestion: 'Use @react-three/fiber Canvas' },
        { regex: /THREE\.PerspectiveCamera/g, type: 'library', name: 'Three.js', suggestion: 'Use @react-three/fiber PerspectiveCamera' },
    ];

    const allPatterns = [...jqueryPatterns, ...vanillaPatterns, ...gsapPatterns, ...threePatterns];

    for (const pattern of allPatterns) {
        const matches = allContent.match(pattern.regex);
        if (matches) {
            const entry = {
                pattern: pattern.regex.source,
                count: matches.length,
                ...pattern
            };
            delete entry.regex;

            switch (pattern.type) {
                case 'event':
                    patterns.eventHandlers.push(entry);
                    break;
                case 'state':
                    patterns.stateNeeded.push(entry);
                    break;
                case 'animation':
                    patterns.animations.push(entry);
                    break;
                case 'api':
                    patterns.apiCalls.push(entry);
                    break;
                case 'dom':
                    patterns.domManipulations.push(entry);
                    break;
                case 'effect':
                    patterns.effects.push(entry);
                    break;
                case 'library':
                    patterns.animations.push(entry); // Libraries go under animations for now
                    break;
            }
        }
    }

    // Detect $(document).ready patterns
    if (/\$\(document\)\.ready/g.test(allContent) || /\$\(function/g.test(allContent)) {
        patterns.effects.push({
            pattern: 'document.ready',
            suggestion: 'useEffect(() => { ... }, []) - runs once on mount'
        });
    }

    // Detect DOMContentLoaded
    if (/DOMContentLoaded/g.test(allContent)) {
        patterns.effects.push({
            pattern: 'DOMContentLoaded',
            suggestion: 'useEffect(() => { ... }, []) - runs once on mount'
        });
    }

    return patterns;
}

/**
 * Generate suggested React state from patterns
 * @param {Object} patterns - Patterns from analyzeJSPatterns
 * @returns {Array} Suggested state variables
 */
function generateStateSuggestions(patterns) {
    const stateVars = new Map();

    // From class toggles
    patterns.stateNeeded.forEach(p => {
        if (p.name === 'classToggle') {
            stateVars.set('isActive', { type: 'boolean', default: 'false', reason: 'Class toggle detected' });
        }
        if (p.name === 'isVisible') {
            stateVars.set('isVisible', { type: 'boolean', default: 'true', reason: 'Show/hide detected' });
        }
        if (p.name === 'inputValue') {
            stateVars.set('inputValue', { type: 'string', default: "''", reason: 'Input value manipulation detected' });
        }
    });

    // From animations
    patterns.animations.forEach(p => {
        if (p.name === 'slideToggle' || p.name === 'slideDown' || p.name === 'slideUp') {
            stateVars.set('isExpanded', { type: 'boolean', default: 'false', reason: 'Slide animation detected' });
        }
        if (p.name === 'fadeIn' || p.name === 'fadeOut') {
            stateVars.set('isVisible', { type: 'boolean', default: 'true', reason: 'Fade animation detected' });
        }
    });

    return Array.from(stateVars.entries()).map(([name, info]) => ({
        name,
        ...info
    }));
}

/**
 * Generate suggested dependencies
 * @param {Object} patterns - Patterns from analyzeJSPatterns
 * @param {Object} detectedLibraries - Libraries detected from the analysis
 * @returns {Array} Suggested npm packages
 */
function generateDependencySuggestions(patterns, detectedLibraries = {}) {
    const deps = new Map();

    // Animation libraries
    if (patterns.animations.length > 0) {
        const hasGSAP = patterns.animations.some(p => p.name?.includes('gsap'));
        const hasThree = patterns.animations.some(p => p.name === 'Three.js');

        if (hasGSAP) {
            deps.set('gsap', { version: '^3.12.0', reason: 'GSAP animations detected' });
            deps.set('@gsap/react', { version: '^2.0.0', reason: 'React GSAP integration' });
        } else if (patterns.animations.some(p => p.suggestion?.includes('framer-motion'))) {
            deps.set('framer-motion', { version: '^10.0.0', reason: 'Animations need React-compatible library' });
        }

        if (hasThree) {
            deps.set('@react-three/fiber', { version: '^8.0.0', reason: 'Three.js detected, use R3F for React' });
            deps.set('@react-three/drei', { version: '^9.0.0', reason: 'Helpful Three.js React utilities' });
        }
    }

    // API calls
    if (patterns.apiCalls.length > 0) {
        deps.set('@tanstack/react-query', { version: '^5.0.0', reason: 'Better data fetching than raw useEffect' });
    }

    // From detected libraries
    const libFiles = detectedLibraries.fromFiles || {};
    Object.keys(libFiles).forEach(libName => {
        const lowerName = libName.toLowerCase();
        if (lowerName.includes('swiper')) {
            deps.set('swiper', { version: '^11.0.0', reason: 'Swiper detected, use React-compatible version' });
        }
        if (lowerName.includes('aos')) {
            deps.set('aos', { version: '^2.3.4', reason: 'AOS animations' });
        }
    });

    return Array.from(deps.entries()).map(([name, info]) => ({
        package: name,
        ...info
    }));
}

/**
 * Clean HTML for React conversion
 * Removes jQuery-specific attributes, normalizes for JSX
 * @param {string} html - Original HTML
 * @returns {Object} Cleaned HTML and notes
 */
function cleanHTMLForReact(html) {
    const notes = [];
    let cleaned = html;

    // Replace class with className
    cleaned = cleaned.replace(/\bclass="/g, 'className="');
    notes.push('Replaced `class` with `className`');

    // Replace for with htmlFor
    cleaned = cleaned.replace(/\bfor="/g, 'htmlFor="');
    if (html.includes('for="')) {
        notes.push('Replaced `for` with `htmlFor`');
    }

    // Self-close void elements
    const voidElements = ['br', 'hr', 'img', 'input', 'meta', 'link', 'source'];
    voidElements.forEach(tag => {
        const regex = new RegExp(`<${tag}([^>]*)(?<!/)>`, 'gi');
        cleaned = cleaned.replace(regex, `<${tag}$1 />`);
    });
    notes.push('Self-closed void elements');

    // Note about inline event handlers
    if (/\bon\w+="/i.test(html)) {
        notes.push('⚠️ Inline event handlers detected - convert to JSX handlers');
    }

    // Note about inline styles
    if (/style="[^"]+"/i.test(html)) {
        notes.push('⚠️ Inline styles detected - convert to style={{ }} objects');
    }

    // Remove data-* jQuery plugin attributes
    const jqueryDataAttrs = ['data-toggle', 'data-target', 'data-dismiss', 'data-slide', 'data-ride'];
    jqueryDataAttrs.forEach(attr => {
        if (html.includes(attr)) {
            notes.push(`⚠️ Bootstrap/jQuery \`${attr}\` detected - needs custom React handling`);
        }
    });

    return { cleaned, notes };
}

/**
 * Generate the conversion context markdown
 * @param {Object} analysis - Full analysis object
 * @returns {string} Markdown optimized for LLM conversion
 */
function generateConversionContext(analysis) {
    const {
        targetInfo,
        cssResults,
        jsResults,
        inlineStyles,
        variableData = {},
        detectedLibraries = {}
    } = analysis;

    // Analyze JS patterns
    const allJsMatches = [
        ...jsResults.flatMap(r => r.matches || []),
        ...(analysis.inlineScripts || [])
    ];
    const patterns = analyzeJSPatterns(allJsMatches);
    const stateSuggestions = generateStateSuggestions(patterns);
    const dependencies = generateDependencySuggestions(patterns, detectedLibraries);

    // Clean HTML
    const { cleaned: cleanedHTML, notes: htmlNotes } = cleanHTMLForReact(targetInfo.html);

    let md = '';

    // Header
    md += `# React/Next.js Conversion Context\n\n`;
    md += `> Generated for converting \`${targetInfo.selector}\` to React\n\n`;
    md += `---\n\n`;

    // Quick Start
    md += `## 🚀 Quick Start for LLM\n\n`;
    md += `Paste this entire document to Claude/GPT with the prompt:\n\n`;
    md += `> "Convert this HTML component to a React functional component with TypeScript. `;
    md += `Use the suggested state, implement the event handlers, and apply the CSS as CSS Modules."\n\n`;
    md += `---\n\n`;

    // Suggested State
    if (stateSuggestions.length > 0) {
        md += `## 📊 Suggested React State\n\n`;
        md += `Based on detected JS patterns, you'll likely need:\n\n`;
        md += `\`\`\`typescript\n`;
        stateSuggestions.forEach(s => {
            md += `const [${s.name}, set${s.name.charAt(0).toUpperCase() + s.name.slice(1)}] = useState<${s.type}>(${s.default}); // ${s.reason}\n`;
        });
        md += `\`\`\`\n\n`;
    }

    // Event Handlers
    if (patterns.eventHandlers.length > 0) {
        md += `## 🎯 Event Handlers to Implement\n\n`;
        md += `| jQuery/Vanilla Pattern | React Equivalent | Count |\n`;
        md += `|------------------------|------------------|-------|\n`;
        patterns.eventHandlers.forEach(e => {
            md += `| \`${e.pattern.substring(0, 40)}\` | \`${e.event}\` | ${e.count} |\n`;
        });
        md += `\n`;
    }

    // Animations
    if (patterns.animations.length > 0) {
        md += `## ✨ Animations Detected\n\n`;
        patterns.animations.forEach(a => {
            md += `- **${a.name || a.pattern}** (${a.count}x) → ${a.suggestion}\n`;
        });
        md += `\n`;
    }

    // DOM Manipulations (Warnings)
    if (patterns.domManipulations.length > 0) {
        md += `## ⚠️ DOM Manipulations to Refactor\n\n`;
        md += `These imperative patterns need to become declarative React:\n\n`;
        patterns.domManipulations.forEach(d => {
            const msg = d.warning || d.suggestion;
            md += `- \`${d.pattern.substring(0, 30)}\` → ${msg}\n`;
        });
        md += `\n`;
    }

    // Effects
    if (patterns.effects.length > 0) {
        md += `## 🔄 useEffect Patterns Needed\n\n`;
        patterns.effects.forEach(e => {
            md += `- ${e.pattern} → ${e.suggestion}\n`;
        });
        md += `\n`;
    }

    // Dependencies
    if (dependencies.length > 0) {
        md += `## 📦 Suggested Dependencies\n\n`;
        md += `\`\`\`bash\nnpm install`;
        dependencies.forEach(d => {
            md += ` ${d.package}`;
        });
        md += `\n\`\`\`\n\n`;
        md += `| Package | Version | Reason |\n`;
        md += `|---------|---------|--------|\n`;
        dependencies.forEach(d => {
            md += `| ${d.package} | ${d.version} | ${d.reason} |\n`;
        });
        md += `\n`;
    }

    md += `---\n\n`;

    // HTML Section
    md += `## 📄 Component HTML (JSX-Ready)\n\n`;
    if (htmlNotes.length > 0) {
        md += `**Transformations applied:**\n`;
        htmlNotes.forEach(n => md += `- ${n}\n`);
        md += `\n`;
    }
    md += `\`\`\`jsx\n${cleanedHTML}\n\`\`\`\n\n`;

    md += `---\n\n`;

    // CSS Variables
    if (variableData && variableData.usedVariables && variableData.usedVariables.length > 0) {
        md += `## 🎨 CSS Variables Required\n\n`;
        const cssVars = variableData.cssVariables || {};
        const scssVars = variableData.scssVariables || {};

        if (Object.keys(cssVars).length > 0) {
            md += `### CSS Custom Properties\n\n`;
            md += `Add to your global styles or component:\n\n`;
            md += `\`\`\`css\n:root {\n`;
            for (const [name, defs] of Object.entries(cssVars)) {
                if (defs[0]) {
                    md += `  ${name}: ${defs[0].value};\n`;
                }
            }
            md += `}\n\`\`\`\n\n`;
        }

        if (Object.keys(scssVars).length > 0) {
            md += `### SCSS Variables\n\n`;
            md += `\`\`\`scss\n`;
            for (const [name, defs] of Object.entries(scssVars)) {
                if (defs[0]) {
                    md += `${name}: ${defs[0].value};\n`;
                }
            }
            md += `\`\`\`\n\n`;
        }

        // Undefined variables warning
        const undefinedVars = [
            ...(variableData.undefinedCSSVariables || []),
            ...(variableData.undefinedSCSSVariables || [])
        ];
        if (undefinedVars.length > 0) {
            md += `### ⚠️ Variables Used But Not Found\n\n`;
            undefinedVars.forEach(v => md += `- \`${v}\`\n`);
            md += `\n> These may come from a framework or external stylesheet.\n\n`;
        }

        md += `---\n\n`;
    }

    // CSS Section
    md += `## 🎨 Component CSS\n\n`;
    md += `Convert to CSS Modules (\`Component.module.css\`) or styled-components:\n\n`;

    // Collect all CSS
    const allCSS = [];
    cssResults.forEach(r => {
        if (r.matches && r.matches.length > 0) {
            r.matches.forEach(m => {
                allCSS.push(m.content);
            });
        }
    });
    inlineStyles?.forEach(s => {
        allCSS.push(s.content);
    });

    if (allCSS.length > 0) {
        // Limit in conversion mode too
        const limitedCSS = allCSS.slice(0, 50);
        md += `\`\`\`css\n${limitedCSS.join('\n\n')}\n\`\`\`\n\n`;
        if (allCSS.length > 50) {
            md += `> ⚠️ ${allCSS.length - 50} more CSS rules omitted. Use \`--max-rules\` to adjust.\n\n`;
        }
    }

    md += `---\n\n`;

    // Checklist
    md += `## ✅ Conversion Checklist\n\n`;
    md += `- [ ] Create \`Component.tsx\` file\n`;
    md += `- [ ] Create \`Component.module.css\` file\n`;
    md += `- [ ] Implement useState hooks\n`;
    md += `- [ ] Convert event handlers to JSX\n`;
    if (patterns.animations.length > 0) {
        md += `- [ ] Set up animation library (framer-motion/GSAP)\n`;
    }
    if (patterns.apiCalls.length > 0) {
        md += `- [ ] Convert API calls to fetch/React Query\n`;
    }
    md += `- [ ] Test component in isolation\n`;
    md += `- [ ] Integrate into Next.js page/layout\n\n`;

    return md;
}

module.exports = {
    analyzeJSPatterns,
    generateStateSuggestions,
    generateDependencySuggestions,
    cleanHTMLForReact,
    generateConversionContext
};
