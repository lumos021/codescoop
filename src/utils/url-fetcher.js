/**
 * URL Fetcher Module
 * Fetches rendered HTML from live URLs for WordPress/Magento/dynamic sites
 */

const https = require('https');
const http = require('http');

/**
 * Fetch HTML content from a URL
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<{html: string, url: string, statusCode: number}>}
 */
async function fetchURL(url, options = {}) {
    const {
        timeout = 30000,
        userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        followRedirects = true,
        maxRedirects = 5
    } = options;

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive'
            },
            timeout
        };

        const req = protocol.request(requestOptions, (res) => {
            // Handle redirects
            if (followRedirects && [301, 302, 303, 307, 308].includes(res.statusCode)) {
                if (maxRedirects <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                const redirectUrl = res.headers.location;
                if (!redirectUrl) {
                    reject(new Error('Redirect without location header'));
                    return;
                }
                // Resolve relative URLs
                const absoluteUrl = redirectUrl.startsWith('http')
                    ? redirectUrl
                    : new URL(redirectUrl, url).toString();

                fetchURL(absoluteUrl, { ...options, maxRedirects: maxRedirects - 1 })
                    .then(resolve)
                    .catch(reject);
                return;
            }

            let data = '';
            res.setEncoding('utf8');

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    html: data,
                    url: url,
                    statusCode: res.statusCode,
                    contentType: res.headers['content-type'] || ''
                });
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Failed to fetch URL: ${error.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });

        req.end();
    });
}

/**
 * Check if input is a URL
 * @param {string} input - Input string
 * @returns {boolean}
 */
function isURL(input) {
    try {
        const url = new URL(input);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Extract base URL for relative path resolution
 * @param {string} url - Full URL
 * @returns {string} Base URL
 */
function getBaseURL(url) {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
}

module.exports = {
    fetchURL,
    isURL,
    getBaseURL
};
