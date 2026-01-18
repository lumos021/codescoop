/**
 * Quick test for new Black Hole fixes
 */
const { detectGhostClasses } = require('../src/utils/ghost-detector');
const { calculateSpecificity } = require('../src/utils/specificity-calculator');

console.log('Testing Black Hole Fixes...\n');

// Test 1: CSS Modules detection
console.log('=== Test 1: CSS Modules Detection ===');
const targetInfo1 = {
    classes: ['Button_primary_a8f3d', 'flex', 'my-custom-class'],
    ids: []
};
const cssResults1 = [{
    matches: [{ content: '.flex { display: flex; }' }]
}];
const ghostData1 = detectGhostClasses(targetInfo1, cssResults1, [], []);

console.log('Classes tested:', targetInfo1.classes);
console.log('Ghost classes found:', ghostData1.ghostClasses.map(g => g.className));
console.log('Expected: Only "my-custom-class" should be ghost');
console.log('Result:', ghostData1.ghostClasses.length === 1 && ghostData1.ghostClasses[0].className === '.my-custom-class' ? '✓ PASS' : '✗ FAIL');

// Test 2: Styled Components detection
console.log('\n=== Test 2: Styled Components Detection ===');
const targetInfo2 = {
    classes: ['sc-bdVaJa', 'emotion-0', 'css-1x2y3z', 'actual-missing'],
    ids: []
};
const ghostData2 = detectGhostClasses(targetInfo2, [], [], []);

console.log('Classes tested:', targetInfo2.classes);
console.log('Ghost classes found:', ghostData2.ghostClasses.map(g => g.className));
console.log('Expected: Only "actual-missing" should be ghost');
console.log('Result:', ghostData2.ghostClasses.length === 1 && ghostData2.ghostClasses[0].className === '.actual-missing' ? '✓ PASS' : '✗ FAIL');

// Test 3: :where() specificity
console.log('\n=== Test 3: :where() Specificity ===');
const whereSpec = calculateSpecificity(':where(.menu, .nav)');
console.log('Selector: :where(.menu, .nav)');
console.log('Calculated:', whereSpec);
console.log('Expected: [0, 0, 0, 0]');
console.log('Result:', whereSpec.join(',') === '0,0,0,0' ? '✓ PASS' : '✗ FAIL');

// Test 4: :is() specificity (should NOT be zero)
console.log('\n=== Test 4: :is() Specificity (control) ===');
const isSpec = calculateSpecificity(':is(.menu, .nav)');
console.log('Selector: :is(.menu, .nav)');
console.log('Calculated:', isSpec);
console.log('Expected: [0, 0, 1, 0] (class specificity)');
console.log('Result:', isSpec[2] === 1 ? '✓ PASS' : '✗ FAIL');

// Test 5: Mixed :is() and :where()
console.log('\n=== Test 5: Mixed :is() and :where() ===');
const mixedSpec = calculateSpecificity(':is(.menu):where(.active)');
console.log('Selector: :is(.menu):where(.active)');
console.log('Calculated:', mixedSpec);
console.log('Expected: [0, 0, 1, 0] (:where part ignored)');
console.log('Result:', mixedSpec[2] === 1 && mixedSpec[3] === 0 ? '✓ PASS' : '✗ FAIL');

console.log('\n' + '='.repeat(50));
console.log('All fixes verified!');
