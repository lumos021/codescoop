
# CodeScoop

> **Scoop the exact code you need for component debugging and migration.**

[![npm version](https://img.shields.io/npm/v/codescoop.svg)](https://www.npmjs.com/package/codescoop)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Stop guessing which CSS rules apply to your HTML. Stop copy-pasting 5,000 lines of code.**

CodeScoop is a forensic tool for your frontend. It extracts the dependency graph of a single component—HTML, specific CSS rules, JS events, and variables—so you can debug legacy sites or feed clean context to an LLM.

## The Problem

You are trying to fix a bug in a legacy WordPress header, or convert it to Next.js.
- **The Debugging Nightmare:** You see `class="btn"`, but where is the style coming from? `style.css`? `bootstrap.min.css`? An inline script?
- **The AI Nightmare:** You paste the HTML into ChatGPT. It hallucinates CSS that doesn't exist or misses the JS logic entirely because you didn't paste the right file.

## The Solution

```bash
codescoop index.html -s "header"
```

**One command. Complete context.**

CodeScoop analyzes your project and generates a forensic report containing:

* The exact HTML structure
* **The Winning CSS:** Specificity scoring shows you exactly which rule wins (and which are overridden)
* **Ghost Classes:** Identifies classes in HTML that have *no* matching CSS
* **JS Forensics:** Finds jQuery listeners and vanilla JS events targeting your elements
* **Variable Resolution:** Inlines values for `var(--primary)` so you don't need to hunt them down

---

## Key Features

### CSS Conflict Detection

Don't just list files. **Solve specificity wars.** CodeScoop calculates specificity scores for every matching rule so you can see exactly why your style isn't applying.

### Ghost Class Detection

Cleaning up legacy code? CodeScoop flags classes in your HTML that have **zero matching CSS rules** in your project. Delete them with confidence.

### Smart Extraction

It doesn't dump the whole file. It extracts *only* the rules that affect your specific component.

* *Result:* A 50-line context file instead of a 5,000-line dump.

### React Conversion Mode (`--for-conversion`)

If you *are* migrating, this flag analyzes JS patterns and suggests:

* State variables (`useState`)
* Event handlers to implement
* Animation libraries to install

### Works With Everything

Static HTML, **Live URLs**, PHP, Blade, Twig, EJS, ERB, Handlebars, JSP, ASP.

### Advanced Modern CSS Support

* **Shadow DOM:** Native support for `::part()` and `::slotted()` selectors allows you to analyze Web Components styling.
* **CSS Houdini:** Detects and reports custom properties defined with `@property`, preserving their type syntax and initial values.

---

## Quick Start

```bash
npm install -g codescoop

# 1. Debug a specific component
codescoop page.html -s ".navbar"

# 2. Analyze a live site (e.g., WordPress local dev)
codescoop http://localhost:8000 -s ".hero" --dir ./wp-content/themes/mytheme

# 3. Get a migration-ready bundle for AI
codescoop page.html -s ".card" --for-conversion
```

---

## Usage Scenarios

### 1. The "Why is this not working?" Audit

You have a button that refuses to turn blue.

```bash
codescoop index.html -s ".btn-primary"
```

**Output:**

```markdown
## CSS Conflict Analysis for `.btn-primary`

| Status | Specificity | File | Rule |
|--------|-------------|------|------|
| Winner | **(0, 2, 0)** | `theme.css:45` | `background: red !important;` |
| Overridden | **(0, 1, 0)** | `main.css:12` | `background: blue;` |
| Overridden | **(0, 0, 1)** | `reset.css:5` | `background: gray;` |
```

*Verdict: `theme.css` is overriding your change with `!important`.*

### 2. The Legacy Cleanup

You inherited a 5-year-old site. You want to know which classes are useless.

```bash
codescoop old-page.html -s "main"
```

**Output:**

```markdown
## Ghost Classes Detected
These classes appear in the HTML but have NO matching CSS in the project:

| Class | Location |
|-------|----------|
| `.clearfix-old` | `line 45` |
| `.legacy-wrapper-v2` | `line 102` |
| `.hidden-xs` | `line 15` |
```

*Action: Safe to delete these from your HTML.*

### 3. The "Perfect Context" for AI

You want to convert a widget to React.

```bash
codescoop widget.php -s ".sidebar-widget" --for-conversion
```

**Output:**

* **Clean HTML:** JSX-ready structure
* **Scoped CSS:** Only the rules needed for this widget
* **JS Hints:** "Found `$('.widget').on('click')` -> Implement `onClick` handler"
* **Variables:** `var(--spacing)` resolved to `16px`

*Result: Paste this into Claude/GPT and get a working component on the first try.*

---

## How It Works

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Your Input     │───▶│    CodeScoop     │───▶│  Forensic Rep   │
│  HTML/URL/PHP   │    │                  │    │                 │
└─────────────────┘    │  ┌────────────┐  │    │  • Specificity  │
                       │  │ Parse HTML │  │    │  • Ghost Classes│
┌─────────────────┐    │  ├────────────┤  │    │  • JS Events    │
│  Project Files  │───▶│  │ Find CSS   │  │    │  • Variables    │
│  CSS/SCSS/JS    │    │  ├────────────┤  │    │  • Clean Code   │
└─────────────────┘    │  │ Calc Score │  │    └─────────────────┘
                       │  ├────────────┤  │
                       │  │ Find Ghosts│  │
                       │  └────────────┘  │
                       └──────────────────┘
```

---

## CLI Reference

```bash
codescoop <source> [options]
```

| Option | Short | Description |
| --- | --- | --- |
| `--selector <sel>` | `-s` | CSS selector to target |
| `--dir <path>` | `-d` | Project directory to scan (Required for live URLs) |
| `--for-conversion` |  | Add React/Next.js migration hints |
| `--compact` | `-c` | Minimal output (hides long code blocks) |
| `--summary-only` |  | Just list files and ghost classes |
| `--skip-minified` |  | Exclude `*.min.css` / `*.min.js` |
| `--max-rules <n>` |  | Max CSS rules per file (Default: 50) |

---

## Why Not Just Copy-Paste?

| Feature | Manual Copy-Paste | CodeScoop |
| --- | --- | --- |
| **Context** | Partial (whatever you see) | Complete (hidden dependencies) |
| **CSS Conflicts** | Guesswork | **Specificity Scoring** |
| **Dead Code** | Hard to find | **Ghost Class Detection** |
| **Variables** | Undefined | Auto-resolved |
| **Time** | 15+ mins per component | < 10 seconds |

---

---

## How CodeScoop Handles Complexity (The "Black Holes")

Frontend analysis is hard. Here is how CodeScoop solves the common "black holes" that break other tools:

### 1. The "Dynamic Class" Trap (`.menu.is-open`)
*   **Problem:** Classes like `.is-open` are often added by JS and missing from static HTML.
*   **Solution:** CodeScoop uses **Greedy Prefix Matching**. If you target `.menu`, we automatically find `.menu.is-open`, `.menu:hover`, and `.menu::before`. We also filter common state classes (`is-*`, `has-*`) to prevent false alarms.

### 2. Nested SCSS (`&__element`)
*   **Problem:** BEM syntax like `&__item` is invisible to standard regex searches.
*   **Solution:** We implement **AST Resolution**. CodeScoop parses your SCSS, unwraps the `&` nesting, and resolves the actual selector (e.g., resolving `&__item` to `.block__item`) to ensure no rule is left behind.

### 3. Tailwind & Runtime CSS
*   **Problem:** Utility classes (`p-4`, `flex`) clutter reports and look like "missing" styles if not built.
*   **Solution:** Our **Smart Filter** distinguishes between likely utility classes (Tailwind/Bootstrap patterns) and your actual missing custom styles, keeping your "Ghost Class" report clean and actionable.

### 4. The Import Maze
*   **Problem:** Styles buried 5 levels deep in `@import` chains are often missed.
*   **Solution:** CodeScoop performs a **Deep Project Scan**, indexing every CSS/SCSS file in your directory to find relevant rules regardless of where they are imported.

### 5. Advanced Modern CSS
*   **Problem:** Modern features like Shadow DOM (`::part`) and CSS Houdini (`@property`) are often ignored by traditional parsers.
*   **Solution:** CodeScoop includes native support for these features, correctly identifying `::part()` and `::slotted()` rules and extracting structured `@property` definitions.

---

## Contributing

Found a bug? Want a feature? PRs welcome!
 
 ```bash
 git clone https://github.com/lumos021/codescoop.git
 cd codescoop && npm install
 node bin/codescoop.js test/sample.html -s ".navbar"
 ```

---

<p align="center">
<b>Debug faster. Migrate smarter. Scoop exactly what you need.</b>

<code>npm install -g codescoop</code>
</p>