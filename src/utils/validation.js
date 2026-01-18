/**
 * Validation Utilities
 * Handles edge cases and input validation
 */

const fs = require('fs');
const path = require('path');

/**
 * Validate HTML file
 * @param {string} filePath - Path to HTML file
 * @returns {Object} Validation result
 */
function validateHTMLFile(filePath) {
    const errors = [];
    const warnings = [];

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        errors.push(`File not found: ${filePath}`);
        return { valid: false, errors, warnings };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (!['.html', '.htm', '.xhtml', '.php', '.ejs', '.hbs', '.pug'].includes(ext)) {
        warnings.push(`File extension "${ext}" is not a typical HTML extension. Proceeding anyway.`);
    }

    // Try to read file
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        if (error.code === 'EACCES') {
            errors.push(`Permission denied: Cannot read ${filePath}`);
        } else if (error.code === 'EISDIR') {
            errors.push(`Path is a directory, not a file: ${filePath}`);
        } else {
            errors.push(`Cannot read file: ${error.message}`);
        }
        return { valid: false, errors, warnings };
    }

    // Check if file is empty
    if (!content || content.trim().length === 0) {
        errors.push('File is empty');
        return { valid: false, errors, warnings };
    }

    // Check if file looks like HTML (has at least some HTML-like content)
    if (!/<[a-z][\s\S]*>/i.test(content)) {
        warnings.push('File does not appear to contain HTML tags');
    }

    // Check if it might be a binary file (has null bytes)
    if (content.includes('\0')) {
        errors.push('File appears to be binary, not text');
        return { valid: false, errors, warnings };
    }

    // Check file size (warn if very large)
    const stats = fs.statSync(filePath);
    const sizeInMB = stats.size / (1024 * 1024);
    if (sizeInMB > 10) {
        warnings.push(`Large file (${sizeInMB.toFixed(2)} MB). Analysis may be slow.`);
    }

    return { valid: true, errors, warnings, content, sizeInMB };
}

/**
 * Validate output path
 * @param {string} outputPath - Path to output file
 * @returns {Object} Validation result
 */
function validateOutputPath(outputPath) {
    const errors = [];
    const warnings = [];

    if (!outputPath) {
        return { valid: true, errors, warnings }; // Will use default
    }

    const dir = path.dirname(outputPath);

    // Check if directory exists
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
            errors.push(`Cannot create output directory: ${error.message}`);
            return { valid: false, errors, warnings };
        }
    }

    // Check if path is a directory
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
        errors.push(`Output path is a directory: ${outputPath}. Please specify a file name.`);
        return { valid: false, errors, warnings };
    }

    // Check if file already exists
    if (fs.existsSync(outputPath)) {
        warnings.push(`Output file already exists and will be overwritten: ${outputPath}`);
    }

    // Check write permission
    try {
        fs.accessSync(dir, fs.constants.W_OK);
    } catch (error) {
        errors.push(`Cannot write to directory: ${dir}`);
        return { valid: false, errors, warnings };
    }

    return { valid: true, errors, warnings };
}

/**
 * Validate project directory
 * @param {string} dirPath - Path to project directory
 * @returns {Object} Validation result
 */
function validateProjectDir(dirPath) {
    const errors = [];
    const warnings = [];

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
        errors.push(`Directory not found: ${dirPath}`);
        return { valid: false, errors, warnings };
    }

    // Check if it's actually a directory
    if (!fs.statSync(dirPath).isDirectory()) {
        errors.push(`Path is not a directory: ${dirPath}`);
        return { valid: false, errors, warnings };
    }

    // Check read permission
    try {
        fs.accessSync(dirPath, fs.constants.R_OK);
    } catch (error) {
        errors.push(`Cannot read directory: ${dirPath}`);
        return { valid: false, errors, warnings };
    }

    // Count files to give user an idea
    try {
        const entries = fs.readdirSync(dirPath);
        if (entries.length === 0) {
            warnings.push('Directory is empty');
        }
    } catch (error) {
        warnings.push(`Could not read directory contents: ${error.message}`);
    }

    return { valid: true, errors, warnings };
}

/**
 * Safe file read with encoding detection
 * @param {string} filePath - Path to file
 * @returns {Object} Result with content or error
 */
function safeReadFile(filePath) {
    try {
        // Try UTF-8 first
        let content = fs.readFileSync(filePath, 'utf-8');

        // Check for BOM and remove if present
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        // Check if content looks corrupted (many replacement characters)
        const replacementChars = (content.match(/\uFFFD/g) || []).length;
        if (replacementChars > content.length * 0.1) {
            return {
                success: false,
                error: 'File encoding issue: Too many invalid characters',
                encoding: 'unknown'
            };
        }

        return { success: true, content, encoding: 'utf-8' };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            encoding: null
        };
    }
}

/**
 * Sanitize selector input
 * Prevents potential injection or crash-causing input
 * @param {string} selector - User-provided selector
 * @returns {Object} Sanitized result
 */
function sanitizeSelector(selector) {
    if (!selector || typeof selector !== 'string') {
        return { valid: false, error: 'Selector must be a non-empty string' };
    }

    const trimmed = selector.trim();

    // Max length check
    if (trimmed.length > 1000) {
        return { valid: false, error: 'Selector is too long (max 1000 characters)' };
    }

    // Check for potentially problematic patterns
    const dangerousPatterns = [
        /javascript:/i,
        /<script/i,
        /on\w+=/i,
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(trimmed)) {
            return { valid: false, error: 'Selector contains invalid patterns' };
        }
    }

    return { valid: true, selector: trimmed };
}

/**
 * Check if a path is safe (no directory traversal attacks)
 * @param {string} basePath - Base directory
 * @param {string} targetPath - Target path to validate
 * @returns {boolean} True if safe
 */
function isPathSafe(basePath, targetPath) {
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(basePath, targetPath);

    return resolvedTarget.startsWith(resolvedBase);
}

/**
 * Format error message for user display
 * @param {Error} error - Error object
 * @param {boolean} verbose - Show stack trace
 * @returns {string} Formatted message
 */
function formatError(error, verbose = false) {
    let message = error.message || 'Unknown error occurred';

    // Add helpful context for common errors
    if (error.code === 'ENOENT') {
        message = `File or directory not found: ${error.path || 'unknown'}`;
    } else if (error.code === 'EACCES') {
        message = `Permission denied: ${error.path || 'unknown'}`;
    } else if (error.code === 'EMFILE') {
        message = 'Too many files open. Try closing some applications.';
    } else if (error.code === 'ENOSPC') {
        message = 'Disk is full. Free up some space.';
    }

    if (verbose && error.stack) {
        message += `\n\nStack trace:\n${error.stack}`;
    }

    return message;
}

module.exports = {
    validateHTMLFile,
    validateOutputPath,
    validateProjectDir,
    safeReadFile,
    sanitizeSelector,
    isPathSafe,
    formatError
};
