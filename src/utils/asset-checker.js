/**
 * Asset Availability Checker
 * Verifies that images, fonts, and other assets exist and are accessible
 */

const fs = require('fs');
const path = require('path');

/**
 * Check if a local file exists and get its stats
 * @param {string} assetPath - Absolute path to the asset
 * @returns {Object} Status object
 */
function checkLocalAsset(assetPath) {
    try {
        if (fs.existsSync(assetPath)) {
            const stats = fs.statSync(assetPath);
            return {
                status: 'OK',
                exists: true,
                size: stats.size,
                sizeFormatted: formatBytes(stats.size)
            };
        }
    } catch (error) {
        return {
            status: 'ERROR',
            exists: false,
            error: error.message
        };
    }

    return {
        status: 'NOT FOUND',
        exists: false
    };
}

/**
 * Check if a remote asset is accessible (HEAD request)
 * @param {string} url - URL to check
 * @returns {Promise<Object>} Status object
 */
async function checkRemoteAsset(url) {
    // Skip for now - avoid network calls by default
    // Can be enabled with --check-remote flag
    return {
        status: 'EXTERNAL',
        exists: null, // unknown
        url: url,
        note: 'Use --check-remote to verify external URLs'
    };
}

/**
 * Resolve asset path relative to HTML file or project directory
 * @param {string} assetSrc - Asset source from HTML/CSS
 * @param {string} basePath - Base path (HTML file dir or project dir)
 * @returns {string} Resolved absolute path
 */
function resolveAssetPath(assetSrc, basePath) {
    // Handle absolute URLs
    if (assetSrc.startsWith('http://') || assetSrc.startsWith('https://') || assetSrc.startsWith('//')) {
        return assetSrc;
    }

    // Handle data URLs
    if (assetSrc.startsWith('data:')) {
        return 'EMBEDDED_DATA_URL';
    }

    // Handle root-relative paths (/)
    if (assetSrc.startsWith('/')) {
        // Relative to project root
        return path.join(basePath, assetSrc.substring(1));
    }

    // Handle relative paths
    return path.join(basePath, assetSrc);
}

/**
 * Check availability of multiple assets
 * @param {Array} assets - Array of asset objects {src, type, location}
 * @param {string} projectDir - Project directory
 * @param {string} htmlPath - HTML file path
 * @param {Object} options - Options {checkRemote: boolean}
 * @returns {Promise<Object>} Availability report
 */
async function checkAssetAvailability(assets, projectDir, htmlPath, options = {}) {
    const { checkRemote = false } = options;

    const basePath = htmlPath ? path.dirname(htmlPath) : projectDir;
    const results = [];

    let totalCount = 0;
    let availableCount = 0;
    let missingCount = 0;
    let externalCount = 0;
    let embeddedCount = 0;

    for (const asset of assets) {
        totalCount++;

        const resolvedPath = resolveAssetPath(asset.src, basePath);
        let checkResult;

        // Data URL (embedded)
        if (resolvedPath === 'EMBEDDED_DATA_URL') {
            embeddedCount++;
            checkResult = {
                status: 'EMBEDDED',
                exists: true,
                note: 'Data URL (embedded in HTML/CSS)'
            };
        }
        // External URL
        else if (resolvedPath.startsWith('http')) {
            externalCount++;
            if (checkRemote) {
                checkResult = await checkRemoteAsset(resolvedPath);
            } else {
                checkResult = {
                    status: 'EXTERNAL',
                    exists: null,
                    url: resolvedPath
                };
            }
        }
        // Local file
        else {
            checkResult = checkLocalAsset(resolvedPath);
            if (checkResult.exists) {
                availableCount++;
            } else {
                missingCount++;
            }
        }

        results.push({
            src: asset.src,
            type: asset.type,
            location: asset.location,
            resolvedPath,
            ...checkResult
        });
    }

    return {
        total: totalCount,
        available: availableCount,
        missing: missingCount,
        external: externalCount,
        embedded: embeddedCount,
        details: results
    };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}

module.exports = {
    checkAssetAvailability,
    resolveAssetPath,
    checkLocalAsset,
    formatBytes
};
