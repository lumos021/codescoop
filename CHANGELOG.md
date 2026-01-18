# Changelog

All notable changes to CodeScoop will be documented in this file.

## [1.0.3] - 2026-01-18

### Added
- **Asset Extraction**: Automatically extracts all images, videos, audio, fonts, and canvas elements from components
  - Extracts from HTML: `<img>`, `<video>`, `<audio>`, `<picture>`, `<canvas>`, `<svg>`
  - Extracts from CSS: `background-image`, `@font-face`, `cursor`, `content`, etc.
- **Asset Availability Checking**: Verifies local file existence and reports file sizes
  - Shows "OK", "NOT FOUND", "EXTERNAL", or "EMBEDDED" status for each asset
  - Warns about missing assets that may cause broken images/functionality
- **WebGL/Canvas Detection**: Identifies canvas elements for 3D rendering context
  - Notes potential WebGL usage for LLM inference (Three.js, Babylon.js, etc.)
  - Provides canvas dimensions for context
- **SVG Inventory**: Lists inline SVG elements with viewBox information
- **Asset Report Section**: New "Assets & Resources" section in markdown output
  - Grouped by type: Images, Videos, Audio, Fonts, Icons, Canvas, SVG
  - Table format for images with path, type, status, size, and location
  - Clear warnings for missing assets

### Enhanced
- Ghost Class Detection: Added 10 new patterns for CSS Modules and CSS-in-JS frameworks
  - CSS Modules: `Component_name_hash` patterns
  - Styled Components: `sc-xxxxx`
  - Emotion: `emotion-0`, `css-xxxxx`
  - JSS: `jss0`, `jss1`
- Specificity Calculator: Fixed `:where()` pseudo-class to correctly return `(0,0,0)` per W3C spec
- Documentation: Added "What We DON'T Handle" section explaining limitations

### Fixed
- `:where()` specificity calculation now W3C compliant

## [1.0.2] - 2026-01-18

### Enhanced
- Ghost Class Detection with CSS Modules and CSS-in-JS pattern filtering
- Specificity calculation W3C compliance improvements
- Documentation clarity enhancements

## [1.0.1] - 2026-01-18

### Fixed
- Corrected GitHub repository URLs in package.json
- Added author name to package metadata

## [1.0.0] - 2026-01-18

### Initial Release

#### Core Features
1. **Nested SCSS Resolution**: Handles `&__element` BEM syntax
2. **Minified CSS Detection**: Auto-detects and beautifies minified files
3. **CSS Specificity Analysis**: Predicts winning rules in cascade conflicts
4. **Ghost Class Detection**: Identifies unused classes with smart utility filtering
5. **Library vs Custom Code**: Separates framework code from project code
6. **CSS Variable Extraction**: Resolves `var(--custom-prop)` values
7. **Modern Pseudo-Classes**: Expands `:is()`, `:where()`, `:not()`, `:has()`
8. **At-Rule Context**: Tracks `@layer`, `@container`, `@supports`, `@media`
9. **Missing Import Detection**: Flags CSS/JS files not linked in HTML
10. **@keyframes Linking**: Associates animations with their definitions
11. **Attribute Selector Matching**: Handles all attribute selector variants
12. **Shadow DOM Support**: Native `::part()` and `::slotted()` detection
13. **CSS Houdini**: Extracts `@property` custom property definitions
14. **Performance Caching**: 3x faster on large projects (50-file LRU cache)

#### Supported Platforms
- Static HTML
- WordPress/PHP (Blade, Twig templates)
- Live URLs
- Magento, Shopify themes
- jQuery/vanilla JS codebases

#### Output Modes
- `--compact`: Concise reports (20 rules/file limit)
- `--for-conversion`: AI-optimized context for React/Next.js conversion
- `--summary-only`: High-level overview without code blocks

---

## Version Format

CodeScoop follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backward compatible)
- **PATCH** version for bug fixes (backward compatible)
