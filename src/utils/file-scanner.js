/**
 * File Scanner Utility
 * Scans project directory for CSS/JS files
 * Also identifies which files are linked in HTML
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

/**
 * Find all CSS and JS files in a project directory
 * @param {string} projectDir - Project directory path
 * @returns {Object} Object with css and js file arrays
 */
async function findProjectFiles(projectDir) {
    const cssPatterns = [
        '**/*.css',
        '**/*.scss',
        '**/*.sass',
        '**/*.less'
    ];

    const jsPatterns = [
        '**/*.js',
        '**/*.mjs',
        '**/*.cjs'
    ];

    const ignorePatterns = [
        '**/node_modules/**',
        '**/bower_components/**',
        '**/vendor/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/*.min.js.map',
        '**/*.min.css.map'
    ];

    const globOptions = {
        cwd: projectDir,
        ignore: ignorePatterns,
        absolute: true,
        nodir: true
    };

    // Find CSS files
    const cssPromises = cssPatterns.map(pattern =>
        glob(pattern, globOptions)
    );
    const cssResults = await Promise.all(cssPromises);
    const cssFiles = [...new Set(cssResults.flat())];

    // Find JS files
    const jsPromises = jsPatterns.map(pattern =>
        glob(pattern, globOptions)
    );
    const jsResults = await Promise.all(jsPromises);
    const jsFiles = [...new Set(jsResults.flat())];

    return {
        css: cssFiles,
        js: jsFiles
    };
}

/**
 * Get files that are actually linked in the HTML
 * @param {CheerioAPI} $ - Cheerio instance with parsed HTML
 * @param {string} htmlPath - Path to the HTML file (for resolving relative paths)
 * @returns {Object} Object with linked css and js file arrays
 */
function getLinkedFiles($, htmlPath) {
    const htmlDir = path.dirname(htmlPath);
    const linkedCSS = [];
    const linkedJS = [];

    // Find linked stylesheets
    $('link[rel="stylesheet"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && !href.startsWith('http') && !href.startsWith('//')) {
            const resolved = resolvePath(href, htmlDir);
            if (resolved) linkedCSS.push(resolved);
        }
    });

    // Find CSS @import in style tags
    $('style').each((_, element) => {
        const content = $(element).html() || '';
        const importMatches = content.matchAll(/@import\s+(?:url\()?['"]?([^'"\)]+)['"]?\)?/g);
        for (const match of importMatches) {
            const href = match[1];
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
                const resolved = resolvePath(href, htmlDir);
                if (resolved) linkedCSS.push(resolved);
            }
        }
    });

    // Find script sources
    $('script[src]').each((_, element) => {
        const src = $(element).attr('src');
        if (src && !src.startsWith('http') && !src.startsWith('//')) {
            const resolved = resolvePath(src, htmlDir);
            if (resolved) linkedJS.push(resolved);
        }
    });

    return {
        css: [...new Set(linkedCSS)],
        js: [...new Set(linkedJS)]
    };
}

/**
 * Resolve a relative path from HTML file location
 */
function resolvePath(relativePath, htmlDir) {
    try {
        // Handle paths starting with /
        if (relativePath.startsWith('/')) {
            // Assume it's relative to project root - try to find the file
            // This is a simplification; in real projects you might need more logic
            relativePath = relativePath.substring(1);
        }

        // Remove query strings and hashes
        relativePath = relativePath.split('?')[0].split('#')[0];

        const resolved = path.resolve(htmlDir, relativePath);

        // Check if file exists
        if (fs.existsSync(resolved)) {
            return resolved;
        }

        // Try without leading dots
        const altPath = path.resolve(htmlDir, relativePath.replace(/^\.\//, ''));
        if (fs.existsSync(altPath)) {
            return altPath;
        }

        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Get file info for display
 */
function getFileInfo(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return {
            path: filePath,
            baseName: path.basename(filePath),
            extension: path.extname(filePath),
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size)
        };
    } catch (e) {
        return {
            path: filePath,
            baseName: path.basename(filePath),
            extension: path.extname(filePath),
            size: 0,
            sizeFormatted: 'N/A'
        };
    }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
    findProjectFiles,
    getLinkedFiles,
    getFileInfo,
    formatFileSize
};
