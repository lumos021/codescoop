/**
 * Interactive CLI Mode
 * Shows HTML structure and lets user select a component
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const { parseHTML, getHTMLStructure } = require('../parsers/html-parser');

/**
 * Run interactive mode to select a component
 * @param {string} htmlPath - Path to HTML file
 * @returns {Object|null} Selected component info or null if cancelled
 */
async function runInteractiveMode(htmlPath) {
    // Parse HTML file
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const $ = parseHTML(htmlContent);

    // Get structure
    const structure = getHTMLStructure($);

    if (structure.length === 0) {
        console.log(chalk.yellow('No significant HTML elements found in the file.'));
        return null;
    }

    // Display structure
    console.log(chalk.cyan('┌─────────────────────────────────────────────────────────────┐'));
    console.log(chalk.cyan('│') + chalk.bold.white('  HTML Structure                                             ') + chalk.cyan('│'));
    console.log(chalk.cyan('├─────────────────────────────────────────────────────────────┤'));

    structure.forEach(item => {
        const indexStr = chalk.gray(`[${String(item.index).padStart(2)}]`);
        const display = item.isChild
            ? chalk.gray(item.display)
            : chalk.white(item.display);
        console.log(chalk.cyan('│') + ` ${indexStr} ${display}`.padEnd(60) + chalk.cyan('│'));
    });

    console.log(chalk.cyan('└─────────────────────────────────────────────────────────────┘'));
    console.log('');

    // Build choices for inquirer
    const choices = structure.map(item => ({
        name: `${item.display}`,
        value: item.selector,
        short: item.selector
    }));

    // Add option to enter custom selector
    choices.push(new inquirer.Separator());
    choices.push({
        name: chalk.yellow('Enter custom selector...'),
        value: '__custom__'
    });
    choices.push({
        name: chalk.gray('Cancel'),
        value: '__cancel__'
    });

    // Prompt for selection
    const { selection } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selection',
            message: 'Select a component to analyze:',
            choices,
            pageSize: 15
        }
    ]);

    if (selection === '__cancel__') {
        return null;
    }

    if (selection === '__custom__') {
        const { customSelector } = await inquirer.prompt([
            {
                type: 'input',
                name: 'customSelector',
                message: 'Enter CSS selector:',
                validate: (input) => {
                    if (!input.trim()) {
                        return 'Please enter a valid CSS selector';
                    }
                    // Basic validation - try to use it
                    try {
                        $(input);
                        return true;
                    } catch (e) {
                        return 'Invalid CSS selector';
                    }
                }
            }
        ]);

        return {
            selector: customSelector,
            mode: 'custom'
        };
    }

    return {
        selector: selection,
        mode: 'selected'
    };
}

/**
 * Display a preview of what will be analyzed
 */
async function showPreview($, selector) {
    const element = $(selector).first();

    if (element.length === 0) {
        console.log(chalk.red(`No element found matching: ${selector}`));
        return false;
    }

    const classes = element.attr('class')?.split(/\s+/).filter(c => c) || [];
    const id = element.attr('id');
    const tagName = element.prop('tagName')?.toLowerCase();
    const childCount = element.find('*').length;

    console.log('');
    console.log(chalk.cyan('Component Preview:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`  Tag: ${chalk.white(tagName)}`);
    if (id) console.log(`  ID: ${chalk.yellow('#' + id)}`);
    if (classes.length > 0) console.log(`  Classes: ${chalk.green(classes.map(c => '.' + c).join(' '))}`);
    console.log(`  Children: ${chalk.gray(childCount + ' elements')}`);
    console.log(chalk.gray('─'.repeat(40)));
    console.log('');

    // Confirm
    const { confirmed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: 'Analyze this component?',
            default: true
        }
    ]);

    return confirmed;
}

module.exports = {
    runInteractiveMode,
    showPreview
};
