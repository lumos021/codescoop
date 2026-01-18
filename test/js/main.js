/**
 * Main JavaScript File
 */

// DOM Ready
document.addEventListener('DOMContentLoaded', function () {
    initDropdowns();
    initProductCards();
    initCTAButton();
});

/**
 * Initialize dropdown menus
 */
function initDropdowns() {
    const dropdownTriggers = document.querySelectorAll('.has-dropdown');

    dropdownTriggers.forEach(trigger => {
        const dropdown = trigger.querySelector('.dropdown-menu');

        trigger.addEventListener('mouseenter', () => {
            dropdown.classList.add('open');
        });

        trigger.addEventListener('mouseleave', () => {
            dropdown.classList.remove('open');
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.has-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.remove('open');
            });
        }
    });
}

/**
 * Initialize product card interactions
 */
function initProductCards() {
    const addToCartButtons = document.querySelectorAll('.add-to-cart');

    addToCartButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.product-card');
            const productId = card.dataset.productId;
            const productTitle = card.querySelector('.product-title').textContent;

            console.log(`Added to cart: ${productTitle} (ID: ${productId})`);

            // Visual feedback
            this.textContent = 'Added!';
            this.style.background = '#28a745';

            setTimeout(() => {
                this.textContent = 'Add to Cart';
                this.style.background = '';
            }, 2000);
        });
    });
}

/**
 * Initialize CTA button
 */
function initCTAButton() {
    const ctaButton = document.getElementById('cta-btn');

    if (ctaButton) {
        ctaButton.addEventListener('click', function () {
            // Scroll to products section
            const productsSection = document.getElementById('products');
            if (productsSection) {
                productsSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// Also initialize via jQuery if available
if (typeof $ !== 'undefined') {
    $(document).ready(function () {
        $('.dropdown-menu').hide();

        $('.has-dropdown').hover(
            function () {
                $(this).find('.dropdown-menu').fadeIn(200);
            },
            function () {
                $(this).find('.dropdown-menu').fadeOut(200);
            }
        );
    });
}
