/**
 * Template Parser Module
 * Parses PHP, Blade, Twig, and other template files by stripping server-side code
 */

const fs = require('fs');
const path = require('path');

/**
 * Supported template types and their patterns
 */
const TEMPLATE_PATTERNS = {
    php: {
        extensions: ['.php', '.phtml', '.inc'],
        // Match <?php ... ?> and <?= ... ?> and <? ... ?>
        patterns: [
            /<\?php[\s\S]*?\?>/gi,
            /<\?=[\s\S]*?\?>/gi,
            /<\?(?!xml)[\s\S]*?\?>/gi
        ],
        // PHP echo shortcuts to preserve (convert to placeholders)
        echoPatterns: [
            { regex: /<\?=\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\?>/g, placeholder: '{{$1}}' },
            { regex: /<\?php\s+echo\s+\$([a-zA-Z_][a-zA-Z0-9_]*)\s*;\s*\?>/g, placeholder: '{{$1}}' }
        ]
    },
    blade: {
        extensions: ['.blade.php'],
        // Blade directives
        patterns: [
            /@(if|else|elseif|endif|foreach|endforeach|for|endfor|while|endwhile|switch|case|break|default|endswitch|unless|endunless|isset|endisset|empty|endempty|auth|endauth|guest|endguest|hasSection|yield|section|endsection|show|parent|include|extends|component|endcomponent|slot|endslot|push|endpush|stack|prepend|endprepend|php|endphp|verbatim|endverbatim|error|enderror|once|endonce|env|endenv|production|endproduction|props|aware|class|disabled|readonly|required|checked|selected)\b[^@]*/gi,
            /\{\{--[\s\S]*?--\}\}/g, // Blade comments
            /\{\!\![\s\S]*?\!\!\}/g, // Unescaped output
        ],
        // Preserve Blade echo as placeholders
        echoPatterns: [
            { regex: /\{\{\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, placeholder: '{{$1}}' }
        ]
    },
    twig: {
        extensions: ['.twig', '.html.twig'],
        patterns: [
            /\{%[\s\S]*?%\}/g, // Twig tags
            /\{#[\s\S]*?#\}/g, // Twig comments
        ],
        echoPatterns: [
            { regex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g, placeholder: '{{$1}}' }
        ]
    },
    ejs: {
        extensions: ['.ejs'],
        patterns: [
            /<%[\s\S]*?%>/g, // EJS tags
            /<%#[\s\S]*?%>/g, // EJS comments
        ],
        echoPatterns: [
            { regex: /<%=\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*%>/g, placeholder: '{{$1}}' }
        ]
    },
    erb: {
        extensions: ['.erb', '.html.erb'],
        patterns: [
            /<%[\s\S]*?%>/g,
            /<%#[\s\S]*?%>/g,
        ],
        echoPatterns: [
            { regex: /<%=\s*@?([a-zA-Z_][a-zA-Z0-9_.]*)\s*%>/g, placeholder: '{{$1}}' }
        ]
    },
    handlebars: {
        extensions: ['.hbs', '.handlebars'],
        patterns: [
            /\{\{#[\s\S]*?\}\}/g, // Block helpers
            /\{\{\/[\s\S]*?\}\}/g, // Close blocks
            /\{\{!--[\s\S]*?--\}\}/g, // Comments
            /\{\{![\s\S]*?\}\}/g, // Inline comments
        ],
        echoPatterns: [
            { regex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g, placeholder: '{{$1}}' }
        ]
    },
    jsp: {
        extensions: ['.jsp', '.jspf'],
        patterns: [
            /<%@[\s\S]*?%>/g, // Directives
            /<%![\s\S]*?%>/g, // Declarations
            /<%[\s\S]*?%>/g, // Scriptlets
            /<%--[\s\S]*?--%>/g, // Comments
        ],
        echoPatterns: [
            { regex: /\$\{([a-zA-Z_][a-zA-Z0-9_.]*)\}/g, placeholder: '{{$1}}' }
        ]
    },
    asp: {
        extensions: ['.asp', '.aspx', '.cshtml', '.vbhtml'],
        patterns: [
            /<%[\s\S]*?%>/g,
            /@\{[\s\S]*?\}/g, // Razor code blocks
            /@[\w]+\([^)]*\)/g, // Razor helpers
        ],
        echoPatterns: [
            { regex: /@([a-zA-Z_][a-zA-Z0-9_.]*)/g, placeholder: '{{$1}}' }
        ]
    }
};

/**
 * Detect template type from file extension
 * @param {string} filePath - Path to template file
 * @returns {string|null} Template type or null
 */
function detectTemplateType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    // Check for compound extensions first (like .blade.php)
    for (const [type, config] of Object.entries(TEMPLATE_PATTERNS)) {
        for (const extension of config.extensions) {
            if (basename.endsWith(extension)) {
                return type;
            }
        }
    }

    // Check simple extension
    for (const [type, config] of Object.entries(TEMPLATE_PATTERNS)) {
        if (config.extensions.includes(ext)) {
            return type;
        }
    }

    return null;
}

/**
 * Check if file is a template file
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function isTemplateFile(filePath) {
    return detectTemplateType(filePath) !== null;
}

/**
 * Parse template file and extract HTML
 * @param {string} filePath - Path to template file
 * @param {Object} options - Parse options
 * @returns {Object} Parsed result with HTML and metadata
 */
function parseTemplateFile(filePath, options = {}) {
    const {
        preserveEchos = true,
        preserveComments = false
    } = options;

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseTemplateContent(content, filePath, { preserveEchos, preserveComments });
}

/**
 * Parse template content and extract HTML
 * @param {string} content - Template content
 * @param {string} filePath - Original file path (for type detection)
 * @param {Object} options - Parse options
 * @returns {Object} Parsed result
 */
function parseTemplateContent(content, filePath, options = {}) {
    const {
        preserveEchos = true,
        preserveComments = false
    } = options;

    const templateType = detectTemplateType(filePath);
    if (!templateType) {
        // Not a template, return as-is
        return {
            html: content,
            templateType: null,
            dynamicClasses: [],
            warnings: []
        };
    }

    const config = TEMPLATE_PATTERNS[templateType];
    let html = content;
    const dynamicClasses = [];
    const warnings = [];

    // First, extract potential dynamic class patterns
    const classPatterns = [
        /class\s*=\s*["'][^"']*<\?[\s\S]*?\?>[^"']*["']/g,
        /class\s*=\s*["'][^"']*\{\{[\s\S]*?\}\}[^"']*["']/g,
        /class\s*=\s*["'][^"']*<%[\s\S]*?%>[^"']*["']/g,
        /:class\s*=\s*["']\{[\s\S]*?\}["']/g, // Vue-like
        /className\s*=\s*\{[\s\S]*?\}/g, // React-like in templates
    ];

    for (const pattern of classPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            matches.forEach(m => {
                dynamicClasses.push({
                    original: m,
                    warning: 'Dynamic class detected - may not be fully extracted'
                });
            });
        }
    }

    if (dynamicClasses.length > 0) {
        warnings.push(`Found ${dynamicClasses.length} dynamic class attribute(s) - these may contain additional classes at runtime`);
    }

    // Preserve echo patterns as placeholders if requested
    if (preserveEchos && config.echoPatterns) {
        for (const echo of config.echoPatterns) {
            html = html.replace(echo.regex, echo.placeholder);
        }
    }

    // Remove server-side code patterns
    for (const pattern of config.patterns) {
        html = html.replace(pattern, '');
    }

    // Clean up excess whitespace but preserve structure
    html = html
        .replace(/^\s*[\r\n]/gm, '\n') // Remove blank lines
        .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
        .trim();

    return {
        html,
        templateType,
        originalContent: content,
        dynamicClasses,
        warnings
    };
}

/**
 * Get list of supported template extensions
 * @returns {string[]}
 */
function getSupportedExtensions() {
    const extensions = [];
    for (const config of Object.values(TEMPLATE_PATTERNS)) {
        extensions.push(...config.extensions);
    }
    return [...new Set(extensions)];
}

module.exports = {
    TEMPLATE_PATTERNS,
    detectTemplateType,
    isTemplateFile,
    parseTemplateFile,
    parseTemplateContent,
    getSupportedExtensions
};
