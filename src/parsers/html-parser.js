/**
 * HTML Parser Module
 * Parses HTML and extracts target elements by selector or line range
 */

const cheerio = require('cheerio');

/**
 * Parse HTML content into a cheerio instance
 * @param {string} htmlContent - Raw HTML string
 * @returns {CheerioAPI} Cheerio instance
 */
function parseHTML(htmlContent) {
    return cheerio.load(htmlContent, {
        recognizeSelfClosing: true,
        lowerCaseTags: false,
        lowerCaseAttributeNames: false
    });
}

/**
 * Extract target element information
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {string} htmlContent - Original HTML content (for line number calculation)
 * @param {Object} options
 * @param {string} options.selector - CSS selector
 * @param {string} options.lineRange - Line range (e.g., "45-80")
 * @param {number} options.matchIndex - Which match to use if multiple (0-based, default: 0)
 * @returns {Object} Target element information
 */
function extractTargetElement($, htmlContent, options) {
    const { selector, lineRange, matchIndex = 0 } = options;

    let targetElement;
    let targetHtml;
    let startLine, endLine;
    let matchCount = 0;
    let warning = null;

    if (selector) {
        // Validate selector syntax
        const normalizedSelector = normalizeSelector(selector);

        // Check for problematic selectors
        const problematicTags = ['body', 'html', 'head'];
        const selectorLower = normalizedSelector.toLowerCase().trim();

        if (problematicTags.includes(selectorLower)) {
            const suggestions = {
                'body': 'Targeting <body> analyzes the entire page. Try targeting a specific section like "main", "header", or a class like ".content".',
                'html': 'Targeting <html> includes everything. Try targeting "body > *" for top-level elements or specific components.',
                'head': 'The <head> tag contains metadata, not visible components. Try targeting visible elements like "header" or "nav".'
            };
            throw new Error(`Cannot analyze "${selectorLower}" as a component.\n\n${suggestions[selectorLower]}`);
        }

        // Warn about very broad selectors
        const broadSelectors = ['div', 'span', 'p', 'a', 'li', 'ul', 'section'];
        if (broadSelectors.includes(selectorLower)) {
            console.warn('\x1b[33m%s\x1b[0m', `⚠️  Selector "${selectorLower}" is very broad and will match many elements.`);
            console.warn('\x1b[33m%s\x1b[0m', `   Consider using a more specific selector like ".${selectorLower}-class" or "#${selectorLower}-id".`);
        }

        // Note about semantic tags (these are fine but informational)
        const semanticTags = ['header', 'footer', 'nav', 'main', 'aside', 'article'];
        if (semanticTags.includes(selectorLower)) {
            console.log('\x1b[36m%s\x1b[0m', `ℹ️  Targeting semantic element <${selectorLower}>. This is typically unique per page.`);
        }

        // Find all matching elements
        const allMatches = $(normalizedSelector);
        matchCount = allMatches.length;

        if (matchCount === 0) {
            // Try to provide helpful error message
            const suggestions = getSelectorSuggestions(selector);
            let errorMsg = `No element found matching selector: ${selector}`;
            if (suggestions) {
                errorMsg += `\n\nDid you mean:\n${suggestions}`;
            }
            throw new Error(errorMsg);
        }

        // Warn if multiple matches found
        if (matchCount > 1) {
            warning = `⚠️  Found ${matchCount} elements matching "${selector}". Using the first one (index ${matchIndex}).`;
            warning += `\n   Use --match-index N to select a different one, or use a more specific selector.`;
            console.warn('\x1b[33m%s\x1b[0m', warning); // Yellow warning
        }

        // Get the specified match (default: first)
        const actualIndex = Math.min(matchIndex, matchCount - 1);
        targetElement = allMatches.eq(actualIndex);

        if (targetElement.length === 0) {
            throw new Error(`Element at index ${matchIndex} not found. Only ${matchCount} matches available.`);
        }

        targetHtml = $.html(targetElement);

        // Calculate line numbers
        const outerHtml = $.html(targetElement);
        const position = htmlContent.indexOf(outerHtml);
        if (position !== -1) {
            const beforeTarget = htmlContent.substring(0, position);
            startLine = (beforeTarget.match(/\n/g) || []).length + 1;
            endLine = startLine + (outerHtml.match(/\n/g) || []).length;
        }
    } else if (lineRange) {
        // Validate line range format
        if (!/^\d+-\d+$/.test(lineRange)) {
            throw new Error(`Invalid line range format: "${lineRange}". Use format like "45-80".`);
        }

        const [start, end] = lineRange.split('-').map(Number);

        // Validate line numbers
        const totalLines = htmlContent.split('\n').length;
        if (start < 1 || end < 1) {
            throw new Error(`Line numbers must be positive. Got: ${lineRange}`);
        }
        if (start > end) {
            throw new Error(`Start line (${start}) cannot be greater than end line (${end}).`);
        }
        if (end > totalLines) {
            throw new Error(`End line (${end}) exceeds file length (${totalLines} lines).`);
        }

        startLine = start;
        endLine = end;

        const lines = htmlContent.split('\n');
        const targetLines = lines.slice(start - 1, end);
        targetHtml = targetLines.join('\n');

        // Parse the extracted HTML to get element info
        const $target = cheerio.load(targetHtml);
        targetElement = $target('body').children().first();

        if (targetElement.length === 0) {
            // If no proper element, treat the whole selection as the target
            targetElement = $target('body');
        }
    } else {
        throw new Error('Either selector or lineRange must be provided');
    }

    // Extract metadata from target element
    const classes = extractClasses(targetElement, $);
    const ids = extractIds(targetElement, $);
    const dataAttributes = extractDataAttributes(targetElement, $);
    const shadowParts = extractShadowParts(targetElement, $);
    const tagName = targetElement.prop('tagName')?.toLowerCase() || 'div';

    // Warn if no classes or IDs found
    if (classes.length === 0 && ids.length === 0) {
        console.warn('\x1b[33m%s\x1b[0m', '⚠️  Target element has no classes or IDs. CSS/JS detection may be limited.');
    }

    // Generate a summary description
    const summary = generateSummary(tagName, classes, ids);

    // Extract assets from target element
    const assets = extractAssets(targetElement, $);

    return {
        html: targetHtml,
        classes,
        ids,
        dataAttributes,
        shadowParts,
        tagName,
        startLine,
        endLine,
        summary,
        selector: selector || `lines ${lineRange}`,
        matchCount,
        warning,
        assets
    };
}

/**
 * Normalize selector - handle common mistakes
 * @param {string} selector - User-provided selector
 * @returns {string} Normalized selector
 */
function normalizeSelector(selector) {
    let normalized = selector.trim();

    // If selector looks like space-separated classes without dots, fix it
    // e.g., "btn primary large" -> ".btn.primary.large"
    if (!normalized.startsWith('.') &&
        !normalized.startsWith('#') &&
        !normalized.includes('[') &&
        !normalized.includes('>') &&
        !normalized.includes(' ') === false &&
        /^[a-zA-Z0-9_-]+(\s+[a-zA-Z0-9_-]+)+$/.test(normalized)) {
        // This looks like multiple class names without dots
        const parts = normalized.split(/\s+/);
        // Only auto-fix if all parts look like class names (no HTML tags)
        const htmlTags = ['div', 'span', 'header', 'footer', 'nav', 'section', 'article', 'aside', 'main', 'p', 'a', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        if (!parts.some(p => htmlTags.includes(p.toLowerCase()))) {
            console.warn('\x1b[33m%s\x1b[0m', `⚠️  Selector "${selector}" looks like class names. Auto-converting to ".${parts.join('.')}"`, `\n   For exact match, use: ".${parts.join('.')}"`);
            normalized = '.' + parts.join('.');
        }
    }

    return normalized;
}

/**
 * Get selector suggestions when element not found
 */
function getSelectorSuggestions(selector) {
    const suggestions = [];

    // If missing dot for class
    if (!selector.startsWith('.') && !selector.startsWith('#') && !selector.includes('[')) {
        if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(selector)) {
            suggestions.push(`  - .${selector}  (as a class)`);
            suggestions.push(`  - #${selector}  (as an ID)`);
            suggestions.push(`  - ${selector}   (as a tag name)`);
        }
    }

    // If has spaces (might be trying to list classes)
    if (selector.includes(' ') && !selector.includes('>')) {
        const parts = selector.split(/\s+/).filter(p => p);
        if (parts.every(p => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(p))) {
            suggestions.push(`  - .${parts.join('.')}  (element with ALL these classes)`);
            suggestions.push(`  - .${parts[0]}  (just the first class)`);
        }
    }

    return suggestions.length > 0 ? suggestions.join('\n') : null;
}

/**
 * Extract all classes from element and its children
 */
function extractClasses(element, $) {
    const classes = new Set();

    // Get classes from the element itself
    const elementClasses = element.attr('class');
    if (elementClasses) {
        elementClasses.split(/\s+/).forEach(cls => {
            if (cls.trim()) classes.add(cls.trim());
        });
    }

    // Get classes from all children
    element.find('*').each((_, child) => {
        const childClasses = $(child).attr('class');
        if (childClasses) {
            childClasses.split(/\s+/).forEach(cls => {
                if (cls.trim()) classes.add(cls.trim());
            });
        }
    });

    return Array.from(classes);
}

/**
 * Extract all IDs from element and its children
 */
function extractIds(element, $) {
    const ids = new Set();

    // Get ID from the element itself
    const elementId = element.attr('id');
    if (elementId) {
        ids.add(elementId);
    }

    // Get IDs from all children
    element.find('*').each((_, child) => {
        const childId = $(child).attr('id');
        if (childId) {
            ids.add(childId);
        }
    });

    return Array.from(ids);
}

/**
 * Extract all data-* attributes from element and its children
 */
function extractDataAttributes(element, $) {
    const dataAttrs = new Set();

    const extractFromElement = (el) => {
        const attribs = el.attribs || {};
        Object.keys(attribs).forEach(attr => {
            if (attr.startsWith('data-')) {
                dataAttrs.add(attr);
            }
        });
    };

    // Get from element itself
    if (element[0]) {
        extractFromElement(element[0]);
    }

    // Get from all children
    element.find('*').each((_, child) => {
        extractFromElement(child);
    });

    return Array.from(dataAttrs);
}

/**
 * Extract 'part' attributes for Shadow DOM matching
 */
function extractShadowParts(element, $) {
    const parts = new Set();

    const extractFromElement = (el) => {
        const part = $(el).attr('part');
        if (part) {
            part.split(/\s+/).forEach(p => {
                if (p.trim()) parts.add(p.trim());
            });
        }
    };

    // Get from element itself
    if (element[0]) {
        extractFromElement(element[0]);
    }

    // Get from all children
    element.find('*').each((_, child) => {
        extractFromElement(child);
    });

    return Array.from(parts);
}

/**
 * Generate a human-readable summary of the target
 */
function generateSummary(tagName, classes, ids) {
    let summary = `<${tagName}`;

    if (ids.length > 0) {
        summary += ` id="${ids[0]}"`;
    }

    if (classes.length > 0) {
        const classStr = classes.slice(0, 3).join(' ');
        summary += ` class="${classStr}${classes.length > 3 ? '...' : ''}"`;
    }

    summary += '>';

    return summary;
}

/**
 * Get the HTML structure for interactive mode
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Array} Array of structure items
 */
function getHTMLStructure($) {
    const structure = [];
    let index = 1;

    // Get major structural elements
    const majorTags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'div[id]', 'div[class]'];

    $('body').children().each((_, element) => {
        const $el = $(element);
        const tagName = element.tagName?.toLowerCase();

        if (!tagName || tagName === 'script' || tagName === 'style') {
            return;
        }

        const id = $el.attr('id');
        const classes = $el.attr('class')?.split(/\s+/).filter(c => c.trim()) || [];

        let selector;
        if (id) {
            selector = `#${id}`;
        } else if (classes.length > 0) {
            selector = `.${classes[0]}`;
        } else {
            selector = tagName;
        }

        // Create display string
        let display = `<${tagName}`;
        if (id) display += ` id="${id}"`;
        if (classes.length > 0) {
            display += ` class="${classes.slice(0, 2).join(' ')}${classes.length > 2 ? '...' : ''}"`;
        }
        display += '>';

        structure.push({
            index: index++,
            tagName,
            selector,
            display,
            hasChildren: $el.children().length > 0
        });

        // Add immediate children that have IDs or significant classes
        $el.children().each((_, child) => {
            const $child = $(child);
            const childTag = child.tagName?.toLowerCase();

            if (!childTag || childTag === 'script' || childTag === 'style') {
                return;
            }

            const childId = $child.attr('id');
            const childClasses = $child.attr('class')?.split(/\s+/).filter(c => c.trim()) || [];

            // Only include children with IDs or semantic classes
            if (childId || childClasses.length > 0) {
                let childSelector;
                if (childId) {
                    childSelector = `#${childId}`;
                } else {
                    childSelector = `.${childClasses[0]}`;
                }

                let childDisplay = `  └── <${childTag}`;
                if (childId) childDisplay += ` id="${childId}"`;
                if (childClasses.length > 0) {
                    childDisplay += ` class="${childClasses.slice(0, 2).join(' ')}${childClasses.length > 2 ? '...' : ''}"`;
                }
                childDisplay += '>';

                structure.push({
                    index: index++,
                    tagName: childTag,
                    selector: childSelector,
                    display: childDisplay,
                    isChild: true
                });
            }
        });
    });

    return structure;
}

/**
 * Extract all assets (images, videos, audio, icons, canvas, SVG) from target element
 * @param {CheerioElement} element - Target element
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Object} Assets grouped by type
 */
function extractAssets(element, $) {
    const assets = {
        images: [],
        videos: [],
        audio: [],
        icons: [],
        canvas: [],
        svgs: []
    };

    // Extract IMG tags
    element.find('img').each((_, el) => {
        const $el = $(el);
        const src = $el.attr('src');
        const srcset = $el.attr('srcset');
        const alt = $el.attr('alt') || '';

        if (src) {
            assets.images.push({
                src,
                type: 'img',
                alt,
                srcset: srcset || null
            });
        }

        // Parse srcset for additional images
        if (srcset) {
            const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
            srcsetUrls.forEach(url => {
                if (url && url !== src) {
                    assets.images.push({
                        src: url,
                        type: 'img-srcset',
                        alt
                    });
                }
            });
        }
    });

    // Extract PICTURE sources
    element.find('picture source').each((_, el) => {
        const $el = $(el);
        const srcset = $el.attr('srcset');
        if (srcset) {
            const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
            srcsetUrls.forEach(url => {
                assets.images.push({
                    src: url,
                    type: 'picture-source'
                });
            });
        }
    });

    // Extract VIDEO tags
    element.find('video').each((_, el) => {
        const $el = $(el);
        const src = $el.attr('src');
        const poster = $el.attr('poster');

        if (src) {
            assets.videos.push({
                src,
                type: 'video',
                poster
            });
        }

        if (poster) {
            assets.images.push({
                src: poster,
                type: 'video-poster'
            });
        }

        // Extract source tags inside video
        $el.find('source').each((_, source) => {
            const sourceSrc = $(source).attr('src');
            if (sourceSrc) {
                assets.videos.push({
                    src: sourceSrc,
                    type: 'video-source'
                });
            }
        });
    });

    // Extract AUDIO tags
    element.find('audio').each((_, el) => {
        const $el = $(el);
        const src = $el.attr('src');

        if (src) {
            assets.audio.push({
                src,
                type: 'audio'
            });
        }

        // Extract source tags inside audio
        $el.find('source').each((_, source) => {
            const sourceSrc = $(source).attr('src');
            if (sourceSrc) {
                assets.audio.push({
                    src: sourceSrc,
                    type: 'audio-source'
                });
            }
        });
    });

    // Extract LINK icons (favicon, apple-touch-icon, etc.)
    element.find('link[rel*="icon"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        const rel = $el.attr('rel');

        if (href) {
            assets.icons.push({
                src: href,
                type: 'icon',
                rel
            });
        }
    });

    // Extract CANVAS elements (for WebGL detection)
    element.find('canvas').each((_, el) => {
        const $el = $(el);
        const id = $el.attr('id');
        const width = $el.attr('width');
        const height = $el.attr('height');

        assets.canvas.push({
            id: id || 'unnamed',
            width: width || 'auto',
            height: height || 'auto',
            type: 'canvas'
        });
    });

    // Extract inline SVG elements (count only, not full content)
    element.find('svg').each((_, el) => {
        const $el = $(el);
        const id = $el.attr('id');
        const viewBox = $el.attr('viewBox');

        assets.svgs.push({
            id: id || 'unnamed',
            viewBox: viewBox || null,
            type: 'inline-svg',
            inline: true
        });
    });

    return assets;
}

module.exports = {
    parseHTML,
    extractTargetElement,
    getHTMLStructure,
    extractAssets
};
