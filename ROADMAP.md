# 📍 ROADMAP.md

**LCC.js + LCC+js** — **Development Roadmap**

This document outlines our **planned improvements, refactors, and example programs** to grow LCC.js and LCC+js into a more educational, maintainable, and contributor-friendly platform.

---

## 🎯 **1. Refactoring & Maintenance**

**Goal**: Make the codebase cleaner, faster, and easier to contribute to.

### ✅ Short-Term Priorities

* **Remove Docker Dependency**

  * Refactor all e2e tests to **use local LCC binaries if installed**, falling back to Docker only when needed.
  * Add clear error messages when neither option is available.
  * Update test helpers to detect environment automatically.

* **Refactor Large Switch Statements**

  * Convert huge `switch` blocks in:

    * `interpreter.js`
    * `assembler.js`
    * `interpreterplus.js`
  * Use **object hash tables** (object maps) to improve readability and performance.

* **Profile & Optimize Performance**

  * Benchmark interpreter and assembler with large `.a` and `.ep` files.
  * Investigate:

    * Reducing memory allocations during execution.
    * Replacing synchronous I/O with streams where feasible.

---

## 🛠️ **2. Testing Enhancements**

**Goal**: Make test coverage more complete and more maintainable.

### ✅ Next Steps

* **Create `compareFiles.js` Utility**

  * Centralize hex, `.lst`, and `.bst` comparisons.
* **Introduce Unit Tests**

  * Add first-pass unit tests for:

    * `assembler.js`
    * `interpreter.js`
    * `linker.js`
    * `lcc.js`
* **Write Smoke Tests**

  * Verify that all binaries are runnable before any other tests.
* **Implement a Single Test Runner Script**

  * Automate running all suites and reporting results in one pass.

---

## ✨ **3. New Example Programs**

**Goal**: Show the power of LCC.js with fun, illustrative demos.

These games and demos will live in the `demos/` folder.

### 🎮 Planned Examples

* 🪨✂️📄 **Rock-Paper-Scissors**

  * Simple input/output demo.
* ✏️ **Hangman**

  * Non-blocking input and screen-clearing using LCC+ instructions.
* 🐦 **Flappy Bird Clone**

  * Terminal-based side-scroller using `sleep`, `rand`, and cursor control.
* ⚔️ **Tiny Roguelike**

  * Turn-based grid movement and random dungeon generation.

Each example will include:

* A commented `.ap` or `.a` source file.
* `.lst` and `.bst` outputs.
* A step-by-step walkthrough in `/docs`.

---

## ✍️ **4. Documentation Improvements**

**Goal**: Make onboarding faster and clearer.

* **Split README into Beginner and Contributor Versions**
* **Add architecture diagrams to `/docs`**
* **Publish a “First 5 Minutes” Quickstart**
* **Document all instructions (standard + extended) with examples**

---

## ⚙️ **5. Future Enhancements**

These are longer-term goals:

* **Symbolic Debugger**

  * Interactive stepping, breakpoints, memory inspection.
* **Terminal Graphics Utilities**

  * Minimal sprite/tile rendering for richer demos.
* **Web Playground**

  * Browser-based interpreter and editor.

---

## 🔄 **Versioning & Releases**

**Version 1.0 Milestone:**

* All major refactors complete.
* All example programs published.
* Docker dependency removed for local test running.
* Tests pass in CI on Linux, macOS, and Windows.

---

## 🏷️ **Labels**

When opening or triaging issues, please use these labels:

* `good first issue`
* `help wanted`
* `needs discussion`
* `performance`
* `example program`

---

## 🙌 **Contributing**

If you’d like to help with any of these items, **open an issue** or **start a draft pull request** to get feedback early!

