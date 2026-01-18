/**
 * COMPREHENSIVE BLACK HOLES VERIFICATION TEST
 * Tests all 13 claimed "Black Hole" solutions
 */

const fs = require('fs');
const path = require('path');
const { runAnalysis } = require('../src/index');

// Test results tracking
const results = {
    passed: [],
    failed: [],
    warnings: []
};

function log(category, message) {
    console.log(`[${category}] ${message}`);
}

function assert(condition, testName, details = '') {
    if (condition) {
        results.passed.push(testName);
        log('✓ PASS', testName);
    } else {
        results.failed.push({ test: testName, details });
        log('✗ FAIL', `${testName} - ${details}`);
    }
}

async function createTestFiles(name, html, css) {
    const testDir = path.join(__dirname, 'blackhole-tests');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

    const htmlPath = path.join(testDir, `${name}.html`);
    const cssPath = path.join(testDir, `${name}.css`);

    fs.writeFileSync(htmlPath, html);
    fs.writeFileSync(cssPath, css);

    return { htmlPath, cssPath, testDir };
}

function cleanup(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
            fs.unlinkSync(path.join(dir, file));
        });
        fs.rmdirSync(dir);
    }
}

async function runBlackHoleTests() {
    console.log('\n='.repeat(60));
    console.log('CodeScoop Black Holes Verification Suite');
    console.log('='.repeat(60));

    // ============================================
    // BLACK HOLE 1: Nested SCSS
    // ============================================
    log('TEST', 'Black Hole 1: Nested SCSS (&__element)');
    {
        const html = '<div class="menu"><div class="menu__item"></div></div>';
        const css = `.menu { padding: 1rem; &__item { color: blue; } &:hover { background: red; } }`;

        const { htmlPath, testDir } = await createTestFiles('bh1-nested-scss', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should find .menu__item (resolved from &__item)
            assert(
                report.includes('.menu__item') || report.includes('menu__item'),
                'BH1: Resolves &__item to .menu__item',
                report.includes('&__item') ? 'Found raw & but not resolved' : 'Not found at all'
            );

            // Should find .menu:hover
            assert(
                report.includes(':hover'),
                'BH1: Resolves &:hover',
                'Pseudo-class not found'
            );

        } catch (e) {
            assert(false, 'BH1: Nested SCSS', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 2: Minified CSS
    // ============================================
    log('TEST', 'Black Hole 2: Minified CSS Detection');
    {
        const html = '<div class="menu"></div>';
        const minified = '.menu{padding:1rem;color:#333;background:#fff;border:1px solid #ccc;margin:0;display:flex;align-items:center;justify-content:space-between;font-size:14px;line-height:1.5;text-decoration:none;cursor:pointer;transition:all 0.3s ease;}';

        const { htmlPath, testDir } = await createTestFiles('bh2-minified', html, minified);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should detect as minified
            assert(
                report.includes('minified') || report.includes('Minified'),
                'BH2: Detects minified CSS',
                'No minification flag found'
            );

            // Should beautify for display (check for newlines in code block)
            const codeBlockMatch = report.match(/```css([\s\S]*?)```/);
            if (codeBlockMatch) {
                const codeContent = codeBlockMatch[1];
                assert(
                    codeContent.split('\n').length > 3,
                    'BH2: Beautifies minified CSS',
                    'Code block still appears minified'
                );
            }

        } catch (e) {
            assert(false, 'BH2: Minified CSS', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 3: Specificity Wars
    // ============================================
    log('TEST', 'Black Hole 3: CSS Specificity Conflicts');
    {
        const html = '<div id="header"><div class="menu btn-primary"></div></div>';
        const css1 = '.menu { color: blue; }';
        const css2 = '#header .menu { color: red; }';
        const css3 = '.btn-primary { color: green !important; }';

        const testDir = path.join(__dirname, 'blackhole-tests');
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

        const htmlPath = path.join(testDir, 'bh3.html');
        fs.writeFileSync(htmlPath, `
            <html>
            <head>
                <link rel="stylesheet" href="style1.css">
                <link rel="stylesheet" href="style2.css">
                <link rel="stylesheet" href="style3.css">
            </head>
            <body>${html}</body>
            </html>
        `);

        fs.writeFileSync(path.join(testDir, 'style1.css'), css1);
        fs.writeFileSync(path.join(testDir, 'style2.css'), css2);
        fs.writeFileSync(path.join(testDir, 'style3.css'), css3);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should show conflict analysis
            assert(
                report.includes('Conflict') || report.includes('Specificity'),
                'BH3: Shows CSS conflicts',
                'No conflict section found'
            );

            // Should show specificity scores
            assert(
                report.includes('0,') && report.includes('1,') || report.includes('(0'),
                'BH3: Displays specificity scores',
                'No specificity notation found'
            );

            // Should identify winner
            assert(
                report.includes('Winner') || report.includes('winner') || report.includes('Overridden'),
                'BH3: Identifies winning rule',
                'No winner/overridden markers'
            );

        } catch (e) {
            assert(false, 'BH3: Specificity Wars', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 4: Ghost Classes (Tailwind Filtering)
    // ============================================
    log('TEST', 'Black Hole 4: Ghost Classes with Utility Filtering');
    {
        const html = '<div class="flex p-4 text-blue-500 my-custom-missing-class hover:bg-red-500"></div>';
        const css = '/* No styles defined */';

        const { htmlPath, testDir } = await createTestFiles('bh4-ghost', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: 'div',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should NOT flag Tailwind utilities as ghosts
            assert(
                !report.includes('flex') || !report.match(/Ghost.*flex/i),
                'BH4: Filters Tailwind "flex"',
                'Tailwind utility flagged as ghost'
            );

            assert(
                !report.includes('p-4') || !report.match(/Ghost.*p-4/i),
                'BH4: Filters Tailwind spacing',
                'Tailwind spacing flagged as ghost'
            );

            // SHOULD flag custom missing class
            assert(
                report.includes('my-custom-missing-class') && report.match(/Ghost/i),
                'BH4: Detects true ghost class',
                'Custom missing class not flagged'
            );

        } catch (e) {
            assert(false, 'BH4: Ghost Classes', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 5: Library vs Custom Code
    // ============================================
    log('TEST', 'Black Hole 5: Library Detection & Separation');
    {
        const html = '<button class="btn btn-primary my-custom-btn"></button>';
        const testDir = path.join(__dirname, 'blackhole-tests');
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

        // Create node_modules/bootstrap structure
        const nodeModulesDir = path.join(testDir, 'node_modules', 'bootstrap', 'dist', 'css');
        fs.mkdirSync(nodeModulesDir, { recursive: true });

        fs.writeFileSync(path.join(nodeModulesDir, 'bootstrap.min.css'),
            '.btn{padding:0.5rem;}.btn-primary{background:blue;}');

        fs.writeFileSync(path.join(testDir, 'custom.css'),
            '.my-custom-btn { border-radius: 8px; }');

        const htmlPath = path.join(testDir, 'bh5.html');
        fs.writeFileSync(htmlPath, `
            <html>
            <head>
                <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
                <link rel="stylesheet" href="custom.css">
            </head>
            <body>${html}</body>
            </html>
        `);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: 'button',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should detect Bootstrap as library
            assert(
                report.match(/Bootstrap/i) || report.match(/Libraries.*Detected/i),
                'BH5: Detects Bootstrap library',
                'No library detection found'
            );

            // Should separate library from custom
            assert(
                report.includes('Custom CSS') || report.match(/custom\.css/),
                'BH5: Shows custom CSS separately',
                'Custom code not separated'
            );

            // Should NOT bloat report with Bootstrap code
            const bootstrapRuleCount = (report.match(/\.btn-primary/g) || []).length;
            assert(
                bootstrapRuleCount < 5,
                'BH5: Minimizes library code display',
                `Bootstrap code appears ${bootstrapRuleCount} times`
            );

        } catch (e) {
            assert(false, 'BH5: Library Detection', e.message);
        } finally {
            // Cleanup
            const nodeModulesPath = path.join(testDir, 'node_modules');
            if (fs.existsSync(nodeModulesPath)) {
                fs.rmSync(nodeModulesPath, { recursive: true, force: true });
            }
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 6: CSS Variables
    // ============================================
    log('TEST', 'Black Hole 6: CSS Variable Resolution');
    {
        const html = '<div class="menu"></div>';
        const css = `
            :root { --primary-color: #007bff; --spacing: 16px; }
            .menu { color: var(--primary-color); padding: var(--spacing); }
        `;

        const { htmlPath, testDir } = await createTestFiles('bh6-vars', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should extract variable usages
            assert(
                report.includes('--primary-color') || report.includes('primary-color'),
                'BH6: Extracts var() usages',
                'Variable usage not found'
            );

            // Should show variable definitions
            assert(
                report.includes('#007bff') || report.includes('007bff'),
                'BH6: Shows variable definitions',
                'Variable value not resolved'
            );

            // Should have Variables section
            assert(
                report.match(/Variables/i),
                'BH6: Has Variables section',
                'No dedicated variables section'
            );

        } catch (e) {
            assert(false, 'BH6: CSS Variables', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 7: Modern Pseudo-Classes
    // ============================================
    log('TEST', 'Black Hole 7: :is(), :where(), :not(), :has()');
    {
        const html = '<div class="menu"></div>';
        const css = `
            :is(.menu, .nav) { color: blue; }
            :where(.menu) { padding: 1rem; }
            :not(.disabled).menu { opacity: 1; }
            .container:has(.menu) { border: 1px solid; }
        `;

        const { htmlPath, testDir } = await createTestFiles('bh7-pseudo', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should find all 4 rules
            const ruleCount = result.cssMatches;
            assert(
                ruleCount >= 3, // At least :is, :where, :not should match .menu
                'BH7: Finds rules with modern pseudo-classes',
                `Only found ${ruleCount} rules, expected 3+`
            );

            // Should preserve original selector structure
            assert(
                report.includes(':is') || report.includes(':where') || report.includes(':not'),
                'BH7: Preserves pseudo-class syntax',
                'Pseudo-classes stripped from output'
            );

        } catch (e) {
            assert(false, 'BH7: Modern Pseudo-Classes', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 8: @layer, @container, @supports
    // ============================================
    log('TEST', 'Black Hole 8: At-Rule Context Tracking');
    {
        const html = '<div class="menu"></div>';
        const css = `
            @layer utilities {
                .menu { padding:1rem; }
            }
            @container (min-width: 400px) {
                .menu { font-size: 2rem; }
            }
            @supports (display: grid) {
                .menu { display: grid; }
            }
        `;

        const { htmlPath, testDir } = await createTestFiles('bh8-atrules', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should track @layer context
            assert(
                report.includes('@layer') && report.includes('utilities'),
                'BH8: Tracks @layer context',
                'Layer context not shown'
            );

            // Should track @container context
            assert(
                report.includes('@container') && report.includes('min-width'),
                'BH8: Tracks @container context',
                'Container context not shown'
            );

            // Should track @supports context
            assert(
                report.includes('@supports') && report.includes('grid'),
                'BH8: Tracks @supports context',
                'Supports context not shown'
            );

        } catch (e) {
            assert(false, 'BH8: At-Rule Context', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 9: Missing Imports
    // ============================================
    log('TEST', 'Black Hole 9: Missing Import Detection');
    {
        const testDir = path.join(__dirname, 'blackhole-tests');
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

        const htmlPath = path.join(testDir, 'bh9.html');
        fs.writeFileSync(htmlPath, `
            <html>
            <head>
                <link rel="stylesheet" href="linked.css">
                <!-- missing.css is NOT linked! -->
            </head>
            <body><div class="menu"></div></body>
            </html>
        `);

        fs.writeFileSync(path.join(testDir, 'linked.css'), '.other { color: red; }');
        fs.writeFileSync(path.join(testDir, 'missing.css'), '.menu { color: blue; }');

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should flag missing.css
            assert(
                report.match(/Missing.*Import/i) || report.includes('NOT Linked') || report.includes('not imported'),
                'BH9: Detects missing imports',
                'No missing import warning'
            );

            assert(
                report.includes('missing.css'),
                'BH9: Names the missing file',
                'File name not shown'
            );

        } catch (e) {
            assert(false, 'BH9: Missing Imports', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 10: @keyframes Links
    // ============================================
    log('TEST', 'Black Hole 10: @keyframes Animation Linking');
    {
        const html = '<div class="menu"></div>';
        const css = `
            @keyframes slideIn {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
            }
            .menu { animation: slideIn 0.3s ease; }
        `;

        const { htmlPath, testDir } = await createTestFiles('bh10-keyframes', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should include keyframes
            assert(
                report.includes('@keyframes') && report.includes('slideIn'),
                'BH10: Includes linked @keyframes',
                'Keyframes not found in report'
            );

            // Should show full keyframe definition
            assert(
                report.includes('translateX'),
                'BH10: Shows keyframe content',
                'Keyframe definition missing'
            );

        } catch (e) {
            assert(false, 'BH10: @keyframes', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 11: Attribute Selectors
    // ============================================
    log('TEST', 'Black Hole 11: Attribute Selector Matching');
    {
        const html = '<div class="menu" data-state="open" aria-expanded="true"></div>';
        const css = `
            [data-state="open"] { display: block; }
            .menu[aria-expanded="true"] { font-weight: bold; }
            [data-state] { border: 1px solid; }
        `;

        const { htmlPath, testDir } = await createTestFiles('bh11-attrs', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should find attribute selectors
            assert(
                result.cssMatches >= 2,
                'BH11: Matches attribute selectors',
                `Only found ${result.cssMatches} rules`
            );

            // Should preserve attribute syntax
            assert(
                report.includes('[data-state') || report.includes('[aria-expanded'),
                'BH11: Preserves attribute syntax',
                'Attribute selectors not shown'
            );

        } catch (e) {
            assert(false, 'BH11: Attribute Selectors', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 12: Shadow DOM
    // ============================================
    log('TEST', 'Black Hole 12: Shadow DOM (::part, ::slotted)');
    {
        const html = '<my-button part="label" class="primary"></my-button>';
        const css = `
            my-button::part(label) { color: blue; }
            my-button.primary::part(icon) { fill: white; }
            ::slotted(.menu) { padding: 1rem; }
        `;

        const { htmlPath, testDir } = await createTestFiles('bh12-shadow', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: 'my-button',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should have Shadow DOM section
            assert(
                report.match(/Shadow DOM/i),
                'BH12: Has Shadow DOM section',
                'No Shadow DOM section found'
            );

            // Should find ::part rules
            assert(
                report.includes('::part'),
                'BH12: Detects ::part selectors',
                '::part not found'
            );

            // Should identify part type
            assert(
                report.includes('label') && report.includes('part'),
                'BH12: Identifies part names',
                'Part name not shown'
            );

        } catch (e) {
            assert(false, 'BH12: Shadow DOM', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // BLACK HOLE 13: CSS Houdini
    // ============================================
    log('TEST', 'Black Hole 13: CSS Houdini (@property)');
    {
        const html = '<div class="menu"></div>';
        const css = `
            @property --my-color {
                syntax: '<color>';
                inherits: false;
                initial-value: #c0ffee;
            }
            .menu { background: var(--my-color); }
        `;

        const { htmlPath, testDir } = await createTestFiles('bh13-houdini', html, css);

        try {
            const result = await runAnalysis({
                htmlPath,
                projectDir: testDir,
                selector: '.menu',
                includeInline: false
            });

            const report = fs.readFileSync(result.outputPath, 'utf-8');

            // Should have Houdini section
            assert(
                report.match(/Houdini/i) || report.includes('@property'),
                'BH13: Has Houdini section',
                'No Houdini section found'
            );

            // Should show property name
            assert(
                report.includes('--my-color'),
                'BH13: Shows property name',
                'Property name not found'
            );

            // Should show syntax/inherits/initial-value
            assert(
                report.includes('color') && report.includes('c0ffee'),
                'BH13: Shows property spec',
                'Property specification missing'
            );

        } catch (e) {
            assert(false, 'BH13: Houdini', e.message);
        } finally {
            cleanup(testDir);
        }
    }

    // ============================================
    // FINAL REPORT
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(60));
    console.log(`✓ Passed: ${results.passed.length}`);
    console.log(`✗ Failed: ${results.failed.length}`);
    console.log(`⚠ Warnings: ${results.warnings.length}`);

    if (results.failed.length > 0) {
        console.log('\nFailed Tests:');
        results.failed.forEach(f => {
            console.log(`  - ${f.test}`);
            if (f.details) console.log(`    ${f.details}`);
        });
    }

    if (results.warnings.length > 0) {
        console.log('\nWarnings:');
        results.warnings.forEach(w => console.log(`  - ${w}`));
    }

    console.log('='.repeat(60));

    process.exit(results.failed.length > 0 ? 1 : 0);
}

runBlackHoleTests().catch(err => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
});
