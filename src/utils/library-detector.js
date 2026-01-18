/**
 * Library Detector Module
 * Identifies common frontend libraries and frameworks
 */

const path = require('path');

/**
 * Known libraries and their detection patterns
 */
const KNOWN_LIBRARIES = {
    // CSS Frameworks
    'Bootstrap': {
        type: 'css-framework',
        patterns: [/bootstrap/i],
        cdnPatterns: [/cdn.*bootstrap/i, /bootstrapcdn/i],
        classPatterns: [/^btn-/, /^col-/, /^row$/, /^container/, /^navbar-/, /^modal-/, /^carousel-/],
        website: 'https://getbootstrap.com'
    },
    'Tailwind CSS': {
        type: 'css-framework',
        patterns: [/tailwind/i],
        classPatterns: [/^(flex|grid|p-|m-|text-|bg-|w-|h-)/],
        website: 'https://tailwindcss.com'
    },
    'Foundation': {
        type: 'css-framework',
        patterns: [/foundation/i],
        website: 'https://get.foundation'
    },

    // JS Libraries
    'jQuery': {
        type: 'js-library',
        patterns: [/jquery/i],
        cdnPatterns: [/code\.jquery\.com/i, /cdn.*jquery/i],
        codePatterns: [/\$\s*\(/, /jQuery\s*\(/],
        website: 'https://jquery.com'
    },
    'GSAP': {
        type: 'js-library',
        patterns: [/gsap/i, /greensock/i],
        codePatterns: [/gsap\./i, /TweenMax/i, /TweenLite/i, /TimelineMax/i],
        website: 'https://greensock.com/gsap'
    },
    'ScrollMagic': {
        type: 'js-library',
        patterns: [/scrollmagic/i],
        codePatterns: [/ScrollMagic/i],
        website: 'https://scrollmagic.io'
    },
    'Swiper': {
        type: 'js-library',
        patterns: [/swiper/i],
        classPatterns: [/^swiper-/],
        codePatterns: [/new Swiper/i],
        website: 'https://swiperjs.com'
    },
    'Isotope': {
        type: 'js-library',
        patterns: [/isotope/i, /isotop/i],
        codePatterns: [/\.isotope\(/i],
        website: 'https://isotope.metafizzy.co'
    },
    'Masonry': {
        type: 'js-library',
        patterns: [/masonry/i],
        codePatterns: [/\.masonry\(/i, /new Masonry/i],
        website: 'https://masonry.desandro.com'
    },
    'AOS': {
        type: 'js-library',
        patterns: [/aos\.js/i, /aos\.css/i],
        classPatterns: [/^aos-/],
        codePatterns: [/AOS\.init/i],
        website: 'https://michalsnik.github.io/aos'
    },
    'Animate.css': {
        type: 'css-library',
        patterns: [/animate\.css/i, /animate\.min\.css/i],
        classPatterns: [/^animate__/, /^animated$/],
        website: 'https://animate.style'
    },
    'Locomotive Scroll': {
        type: 'js-library',
        patterns: [/locomotive/i],
        codePatterns: [/LocomotiveScroll/i],
        website: 'https://locomotivemtl.github.io/locomotive-scroll'
    },

    // Icon Libraries
    'Font Awesome': {
        type: 'icon-library',
        patterns: [/fontawesome/i, /font-awesome/i],
        classPatterns: [/^fa-/, /^fas$/, /^fab$/, /^far$/, /^fal$/],
        website: 'https://fontawesome.com'
    },
    'Material Icons': {
        type: 'icon-library',
        patterns: [/material-icons/i, /material-design-icons/i],
        classPatterns: [/^material-icons/],
        website: 'https://fonts.google.com/icons'
    },
    'Boxicons': {
        type: 'icon-library',
        patterns: [/boxicons/i],
        classPatterns: [/^bx-/, /^bx$/],
        website: 'https://boxicons.com'
    },
    'Remix Icon': {
        type: 'icon-library',
        patterns: [/remixicon/i],
        classPatterns: [/^ri-/],
        website: 'https://remixicon.com'
    },

    // Utility Libraries
    'Lodash': {
        type: 'js-library',
        patterns: [/lodash/i],
        codePatterns: [/_\.\w+\(/],
        website: 'https://lodash.com'
    },
    'Axios': {
        type: 'js-library',
        patterns: [/axios/i],
        codePatterns: [/axios\.(get|post|put|delete)/i],
        website: 'https://axios-http.com'
    },

    // Image/Media
    'Lightbox': {
        type: 'js-library',
        patterns: [/lightbox/i],
        codePatterns: [/lightbox/i],
        website: 'https://lokeshdhakar.com/projects/lightbox2'
    },
    'Fancybox': {
        type: 'js-library',
        patterns: [/fancybox/i],
        codePatterns: [/fancybox/i],
        website: 'https://fancyapps.com/fancybox'
    },
    'ImagesLoaded': {
        type: 'js-library',
        patterns: [/imagesloaded/i],
        codePatterns: [/imagesLoaded/i],
        website: 'https://imagesloaded.desandro.com'
    },

    // Form Libraries
    'Select2': {
        type: 'js-library',
        patterns: [/select2/i],
        classPatterns: [/^select2-/],
        codePatterns: [/\.select2\(/i],
        website: 'https://select2.org'
    },

    // Charts
    'Chart.js': {
        type: 'js-library',
        patterns: [/chart\.js/i, /chartjs/i],
        codePatterns: [/new Chart/i],
        website: 'https://www.chartjs.org'
    },

    // Scroll Libraries
    'Smooth Scroll': {
        type: 'js-library',
        patterns: [/smooth-scroll/i, /smoothscroll/i],
        codePatterns: [/SmoothScroll/i],
        website: ''
    },
    'ScrollTrigger': {
        type: 'js-library',
        patterns: [/scrolltrigger/i, /scrolltiger/i],
        codePatterns: [/ScrollTrigger/i],
        website: 'https://greensock.com/scrolltrigger'
    }
};

/**
 * Detect libraries from file paths
 * @param {string[]} filePaths - Array of file paths
 * @returns {Object} Detected libraries with their import status
 */
function detectLibrariesFromPaths(filePaths) {
    const detected = {};

    for (const filePath of filePaths) {
        const fileName = path.basename(filePath).toLowerCase();
        const fullPath = filePath.toLowerCase();

        for (const [libName, libInfo] of Object.entries(KNOWN_LIBRARIES)) {
            // Check file path patterns
            const matchesPattern = libInfo.patterns?.some(pattern =>
                pattern.test(fileName) || pattern.test(fullPath)
            );

            if (matchesPattern) {
                if (!detected[libName]) {
                    detected[libName] = {
                        ...libInfo,
                        name: libName,
                        files: [],
                        importedFiles: [],
                        missingFiles: []
                    };
                }
                detected[libName].files.push(filePath);
            }
        }
    }

    return detected;
}

/**
 * Detect libraries from HTML content (CDN links)
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Object} Libraries loaded via CDN
 */
function detectLibrariesFromHTML($) {
    const cdnLibraries = [];

    // Check link tags
    $('link[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        for (const [libName, libInfo] of Object.entries(KNOWN_LIBRARIES)) {
            const matchesCDN = libInfo.cdnPatterns?.some(pattern => pattern.test(href));
            const matchesPattern = libInfo.patterns?.some(pattern => pattern.test(href));

            if (matchesCDN || (matchesPattern && href.includes('cdn'))) {
                cdnLibraries.push({
                    name: libName,
                    type: libInfo.type,
                    source: 'cdn',
                    url: href,
                    website: libInfo.website
                });
            }
        }
    });

    // Check script tags
    $('script[src]').each((_, el) => {
        const src = $(el).attr('src') || '';
        for (const [libName, libInfo] of Object.entries(KNOWN_LIBRARIES)) {
            const matchesCDN = libInfo.cdnPatterns?.some(pattern => pattern.test(src));
            const matchesPattern = libInfo.patterns?.some(pattern => pattern.test(src));

            if (matchesCDN || (matchesPattern && src.includes('cdn'))) {
                cdnLibraries.push({
                    name: libName,
                    type: libInfo.type,
                    source: 'cdn',
                    url: src,
                    website: libInfo.website
                });
            }
        }
    });

    return cdnLibraries;
}

/**
 * Detect libraries from class names in HTML
 * @param {string[]} classes - Array of class names
 * @returns {string[]} Library names detected from classes
 */
function detectLibrariesFromClasses(classes) {
    const detected = new Set();

    for (const className of classes) {
        for (const [libName, libInfo] of Object.entries(KNOWN_LIBRARIES)) {
            if (libInfo.classPatterns) {
                const matches = libInfo.classPatterns.some(pattern => pattern.test(className));
                if (matches) {
                    detected.add(libName);
                }
            }
        }
    }

    return Array.from(detected);
}

/**
 * Check if a file is a library file
 * @param {string} filePath - Path to the file
 * @returns {Object|null} Library info if it's a library file
 */
function isLibraryFile(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    const fullPath = filePath.toLowerCase();

    for (const [libName, libInfo] of Object.entries(KNOWN_LIBRARIES)) {
        const matchesPattern = libInfo.patterns?.some(pattern =>
            pattern.test(fileName) || pattern.test(fullPath)
        );

        if (matchesPattern) {
            return { name: libName, ...libInfo };
        }
    }

    // Also check for common library indicators
    if (fileName.includes('.min.') &&
        (fileName.includes('plugin') ||
            fullPath.includes('/plugins/') ||
            fullPath.includes('/vendor/') ||
            fullPath.includes('/lib/'))) {
        return { name: 'Unknown Plugin', type: 'plugin' };
    }

    return null;
}

/**
 * Get all known library names
 */
function getKnownLibraryNames() {
    return Object.keys(KNOWN_LIBRARIES);
}

module.exports = {
    KNOWN_LIBRARIES,
    detectLibrariesFromPaths,
    detectLibrariesFromHTML,
    detectLibrariesFromClasses,
    isLibraryFile,
    getKnownLibraryNames
};
