/**
 * Ghost Classes Detector
 * Finds classes in HTML that have no matching CSS rules anywhere in the project
 * 
 * UPDATES:
 * - Enhanced documentation
 * - Better handling of modern CSS frameworks
 */

/**
 * Detect ghost classes (classes with no CSS definitions)
 * @param {Object} targetInfo - Target element info with classes
 * @param {Array} cssResults - CSS analysis results
 * @param {Array} cssLibraryResults - Library CSS results
 * @param {Array} inlineStyles - Inline style results
 * @returns {Object} Ghost class detection results
 */
function detectGhostClasses(targetInfo, cssResults = [], cssLibraryResults = [], inlineStyles = []) {
    const { classes = [] } = targetInfo;

    if (classes.length === 0) {
        return {
            ghostClasses: [],
            definedClasses: [],
            totalClasses: 0
        };
    }

    // Collect all classes that have CSS definitions
    const definedClasses = new Set();

    // Helper function to process matchedOn (can be string or array)
    const processMatchedOn = (matchedOn) => {
        const items = Array.isArray(matchedOn) ? matchedOn : [matchedOn];
        for (const item of items) {
            if (typeof item === 'string' && item.startsWith('class:')) {
                definedClasses.add('.' + item.replace('class: ', '').replace('class:', '').trim());
            }
        }
    };

    // Check custom CSS results
    for (const result of cssResults) {
        for (const match of result.matches || []) {
            // Extract class name from match info
            processMatchedOn(match.matchedOn);

            // Also check the selector directly (handles :is(), :where(), etc.)
            const selector = match.selector || '';
            for (const cls of classes) {
                if (selector.includes(cls)) {
                    definedClasses.add(cls);
                }
            }
        }
    }

    // Check library CSS results
    for (const result of cssLibraryResults) {
        for (const match of result.matches || []) {
            processMatchedOn(match.matchedOn);

            const selector = match.selector || '';
            for (const cls of classes) {
                if (selector.includes(cls)) {
                    definedClasses.add(cls);
                }
            }
        }
    }

    // Check inline styles (less common to match classes, but check anyway)
    for (const style of inlineStyles) {
        const content = style.content || '';
        for (const cls of classes) {
            if (content.includes(cls)) {
                definedClasses.add(cls);
            }
        }
    }

    // Common utility patterns to ignore (Tailwind, Bootstrap, State classes)
    const IGNORED_PATTERNS = [
        // Tailwind / Utility patterns
        /^(p|m)[xytrbl]?-\d+/,      // Spacing: p-4, my-2, mt-10
        /^text-(xs|sm|base|lg|xl|\d+xl)/, // Typo sizes
        /^text-(black|white|gray|red|blue|green|yellow|indigo|purple|pink)/, // Colors
        /^bg-(black|white|gray|red|blue|green|yellow|indigo|purple|pink)/,   // Backgrounds
        /^font-(sans|serif|mono|bold|medium|light)/, // Fonts
        /^flex/, /^grid/, /^block/, /^hidden/, /^inline/, // Layout
        /^w-\d+/, /^h-\d+/, /^w-full/, /^h-full/, /^min-w/, /^max-w/, // Sizing
        /^border/, /^rounded/, /^shadow/, // Decorations
        /^items-/, /^justify-/, /^place-/, /^gap-/, // Flex/Grid alignment
        /^absolute/, /^relative/, /^fixed/, /^sticky/, // Position
        /^top-/, /^bottom-/, /^left-/, /^right-/, /^z-/, // Positioning
        /^opacity-/, /^cursor-/, /^pointer-events-/, // Interaction
        /^transition/, /^duration-/, /^ease-/, // Transitions
        /^hover:/, /^focus:/, /^active:/, /^group-hover:/, // State modifiers
        /^sm:/, /^md:/, /^lg:/, /^xl:/, /^2xl:/, // Responsive modifiers

        // Bootstrap patterns
        /^col-/, /^row/, /^container/, /^btn-/, /^alert-/, /^card-/,
        /^navbar-/, /^nav-/, /^dropdown-/, /^modal-/, /^tab-/, /^form-/,

        // Icons
        /^fa-/, /^icon-/, /^material-/, /^bi-/, /^ri-/, /^bx-/,

        // State hooks & JS hooks (often not defined in CSS directly but added by JS)
        /^js-/, /^is-/, /^has-/, /^active/, /^open/, /^show/, /^visible/,

        // Animation libraries
        /^animate__/, /^aos-/, /^fade/, /^slide/, /^zoom/,

        // Utility libraries
        /^u-/, /^util-/, /^helper-/
    ];

    // Find ghost classes (in HTML but not in any CSS)
    const ghostClasses = classes.filter(cls => {
        const className = cls.startsWith('.') ? cls : '.' + cls;
        const cleanName = cls.startsWith('.') ? cls.substring(1) : cls;

        // Check if it exists in CSS
        if (definedClasses.has(className) || definedClasses.has(cls)) {
            return false;
        }

        // Check against allowlist (ignore utilities)
        const isUtility = IGNORED_PATTERNS.some(pattern => pattern.test(cleanName));
        if (isUtility) {
            return false;
        }

        return true;
    });

    return {
        ghostClasses,
        definedClasses: Array.from(definedClasses),
        totalClasses: classes.length,
        hasGhosts: ghostClasses.length > 0
    };
}

/**
 * Format ghost classes as markdown section
 * @param {Object} ghostData - Ghost detection results
 * @returns {string} Markdown section
 */
function formatGhostClassesMarkdown(ghostData) {
    if (!ghostData.hasGhosts) {
        return '';
    }

    let md = `\n---\n\n## 👻 Ghost Classes Detected\n\n`;
    md += `> These classes are used in the HTML but have **no matching CSS rules** in the project.\n`;
    md += `> This may indicate dead code, missing stylesheets, or dynamically applied styles.\n\n`;

    md += `| Class | Status |\n`;
    md += `|-------|--------|\n`;

    for (const ghost of ghostData.ghostClasses) {
        md += `| \`${ghost}\` | ⚠️ No CSS found |\n`;
    }

    md += `\n**${ghostData.ghostClasses.length}** ghost class(es) out of **${ghostData.totalClasses}** total.\n`;

    return md;
}

module.exports = {
    detectGhostClasses,
    formatGhostClassesMarkdown
};