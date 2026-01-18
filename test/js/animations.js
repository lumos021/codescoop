// This file is NOT linked in the HTML but contains relevant code
// The tool should detect this as a "missing import"

function initDropdownAnimations() {
    const dropdown = document.querySelector('.dropdown-menu');

    if (dropdown) {
        dropdown.addEventListener('transitionend', function () {
            console.log('Dropdown animation complete');
        });
    }
}

// Product card hover effects
document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('mouseenter', function () {
        this.style.transform = 'scale(1.02)';
    });

    card.addEventListener('mouseleave', function () {
        this.style.transform = '';
    });
});

// Export for module systems
if (typeof module !== 'undefined') {
    module.exports = { initDropdownAnimations };
}
