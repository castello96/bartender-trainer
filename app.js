document.addEventListener("DOMContentLoaded", () => {
    const ingredientsListEl = document.getElementById("ingredients-list");
    const cocktailNameEl = document.getElementById("current-cocktail-name");
    const statusEl = document.getElementById("status-message");
    const feedbackEl = document.getElementById("feedback");
    const nextCocktailBtn = document.getElementById("next-cocktail-btn");
    const checkBtn = document.getElementById("check-btn");
    const modeButtons = document.querySelectorAll(".mode-btn"); // easy/hard
    const poolButtons = document.querySelectorAll(".pool-btn"); // training/full

    const CATEGORY_LABELS = {
        "spirits": "Spirits",
        "liqueurs": "Liqueurs",
        "mixers": "Mixers",
        "juices": "Juices",
        "syrups-sweeteners": "Syrups & Sweeteners",
        "garnishes-muddled": "Garnishes & Muddled",
        "house-specials": "House Specials",
        "other": "Other"
    };

    const CATEGORY_ORDER = [
        "spirits",
        "liqueurs",
        "mixers",
        "juices",
        "syrups-sweeteners",
        "garnishes-muddled",
        "house-specials",
        "other"
    ];

    let allIngredients = [];
    let recipes = [];
    let currentRecipe = null;
    let difficultyMode = "easy";   // easy | hard
    let poolMode = "training";     // training | full
    let configsLoaded = false;
    let currentAllowedIngredientIds = null; // Set or null (null = all)

    // Load config files
    loadConfigs();

    function loadConfigs() {
        Promise.all([
            fetch("ingredients.json").then((res) => res.json()),
            fetch("recipes.json").then((res) => res.json())
        ])
            .then(([ingredientsData, recipesData]) => {
                allIngredients = ingredientsData.ingredients || [];
                recipes = recipesData || [];
                configsLoaded = true;
                statusEl.textContent =
                    'Configs loaded. Choose a mode and click "New Cocktail" to begin.';
                checkBtn.disabled = true;
                // We will render ingredients when a cocktail is selected
            })
            .catch((err) => {
                console.error("Error loading configs:", err);
                statusEl.textContent =
                    "Error loading configuration files. Make sure they exist and are valid JSON.";
            });
    }

    // Render ingredients, grouped by category.
    // allowedIds: Set of ingredient ids to show; if null, show all.
    function renderIngredientsList(allowedIds = null) {
        ingredientsListEl.innerHTML = "";

        const byCategory = new Map();

        allIngredients.forEach((ing) => {
            if (allowedIds && !allowedIds.has(ing.id)) return;

            const cat = ing.category || "other";
            if (!byCategory.has(cat)) {
                byCategory.set(cat, []);
            }
            byCategory.get(cat).push(ing);
        });

        let categoriesRendered = 0;

        CATEGORY_ORDER.forEach((catKey) => {
            const list = byCategory.get(catKey);
            if (!list || list.length === 0) return;

            categoriesRendered++;

            const section = document.createElement("section");
            section.className = "ingredient-category";

            const title = document.createElement("h3");
            title.className = "ingredient-category-title";
            title.textContent = CATEGORY_LABELS[catKey] || catKey;

            const grid = document.createElement("div");
            grid.className = "ingredients-grid";

            list.forEach((ing) => {
                const card = document.createElement("div");
                card.className = "ingredient-card";
                card.dataset.ingredientId = ing.id;

                card.innerHTML = `
          <img src="${ing.image}" alt="${ing.displayName}" />
          <div class="ingredient-info">
            <label>
              <input type="checkbox" class="ingredient-checkbox" />
              <span class="ingredient-name">${ing.displayName}</span>
            </label>
            <div class="amount-row">
              <input
                type="number"
                class="ingredient-amount"
                min="0"
                step="0.25"
                placeholder="0"
              />
              <span class="ingredient-unit"></span>
            </div>
          </div>
        `;

                const checkbox = card.querySelector(".ingredient-checkbox");
                const amountInput = card.querySelector(".ingredient-amount");

                // Toggle amount input enabled/disabled in hard mode
                checkbox.addEventListener("change", () => {
                    if (difficultyMode === "hard") {
                        amountInput.disabled = !checkbox.checked;
                        if (!checkbox.checked) {
                            amountInput.value = "";
                        }
                    }
                });

                grid.appendChild(card);
            });

            section.appendChild(title);
            section.appendChild(grid);
            ingredientsListEl.appendChild(section);
        });

        if (categoriesRendered === 0) {
            ingredientsListEl.innerHTML =
                '<p class="hint">No ingredients to show yet. Click "New Cocktail" to begin.</p>';
        }

        updateModeUI();
    }

    function updateModeUI() {
        const cards = ingredientsListEl.querySelectorAll(".ingredient-card");
        cards.forEach((card) => {
            const amountRow = card.querySelector(".amount-row");
            const amountInput = card.querySelector(".ingredient-amount");
            const checkbox = card.querySelector(".ingredient-checkbox");

            if (difficultyMode === "easy") {
                amountRow.style.display = "none";
                amountInput.value = "";
                amountInput.disabled = true;
            } else {
                amountRow.style.display = "flex";
                amountInput.disabled = !checkbox.checked;
            }
        });
    }

    // Difficulty buttons (easy / hard)
    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            if (mode === difficultyMode) return;

            difficultyMode = mode;
            modeButtons.forEach((b) => {
                b.classList.toggle("active", b === btn);
            });

            updateModeUI();
            clearFeedback();

            if (currentRecipe) {
                statusEl.textContent = `Difficulty: ${capitalize(
                    difficultyMode
                )}. Current cocktail: ${currentRecipe.name}.`;
            } else {
                statusEl.textContent = `Difficulty: ${capitalize(
                    difficultyMode
                )}. Click "New Cocktail" to start.`;
            }
        });
    });

    // Ingredient pool buttons (training / full bar)
    poolButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const pool = btn.dataset.pool;
            if (pool === poolMode) return;

            poolMode = pool;
            poolButtons.forEach((b) => {
                b.classList.toggle("active", b === btn);
            });

            clearFeedback();

            if (!configsLoaded) return;

            if (currentRecipe) {
                // Recalculate allowed ingredients and rerender
                currentAllowedIngredientIds = getAllowedIngredientIdsForCurrentRecipe();
                renderIngredientsList(currentAllowedIngredientIds);
                resetSelectionsForNewRecipe();
                statusEl.textContent =
                    poolMode === "training"
                        ? "Training view: showing this cocktail's ingredients plus some distractors."
                        : "Full bar view: all ingredients are visible.";
            } else {
                if (poolMode === "full") {
                    currentAllowedIngredientIds = null;
                    renderIngredientsList(null);
                    statusEl.textContent =
                        "Full bar view: all ingredients. Click \"New Cocktail\" to start practicing.";
                } else {
                    ingredientsListEl.innerHTML =
                        '<p class="hint">Training view is focused per cocktail. Click "New Cocktail" to begin.</p>';
                    statusEl.textContent =
                        "Training view: click \"New Cocktail\" to see focused ingredients for that drink.";
                }
            }
        });
    });

    // New cocktail button
    nextCocktailBtn.addEventListener("click", () => {
        if (!configsLoaded || recipes.length === 0) {
            statusEl.textContent = "Configs not loaded yet or no recipes found.";
            return;
        }

        currentRecipe = getRandomRecipe();
        cocktailNameEl.textContent = `Make a ${currentRecipe.name}`;

        currentAllowedIngredientIds = getAllowedIngredientIdsForCurrentRecipe();
        renderIngredientsList(currentAllowedIngredientIds);
        resetSelectionsForNewRecipe();
        clearFeedback();
        checkBtn.disabled = false;

        statusEl.textContent =
            "Select the ingredients you think belong in this cocktail" +
            (difficultyMode === "hard" ? " and their amounts." : ".");
    });

    // Check button
    checkBtn.addEventListener("click", () => {
        if (!currentRecipe) {
            statusEl.textContent =
                'No cocktail selected. Click "New Cocktail" first.';
            return;
        }

        if (difficultyMode === "easy") {
            evaluateEasyMode();
        } else {
            evaluateHardMode();
        }
    });

    function getAllowedIngredientIdsForCurrentRecipe() {
        if (!currentRecipe) return null;

        const recipeIds = currentRecipe.ingredients.map((ing) => ing.ingredientId);

        if (poolMode === "full") {
            // null = show all ingredients
            return null;
        }

        // Training mode: show recipe ingredients + some random distractors
        const allowed = new Set(recipeIds);
        const maxDistractors = 5;

        const distractorCandidates = allIngredients
            .map((ing) => ing.id)
            .filter((id) => !allowed.has(id));

        // Shuffle candidates
        distractorCandidates.sort(() => Math.random() - 0.5);

        for (const id of distractorCandidates) {
            if (allowed.size >= recipeIds.length + maxDistractors) break;
            allowed.add(id);
        }

        return allowed;
    }

    function resetSelectionsForNewRecipe() {
        const cards = ingredientsListEl.querySelectorAll(".ingredient-card");

        const recipeMap = new Map();
        currentRecipe.ingredients.forEach((ri) =>
            recipeMap.set(ri.ingredientId, ri)
        );

        cards.forEach((card) => {
            const ingredientId = card.dataset.ingredientId;
            const checkbox = card.querySelector(".ingredient-checkbox");
            const amountInput = card.querySelector(".ingredient-amount");
            const unitSpan = card.querySelector(".ingredient-unit");

            checkbox.checked = false;
            amountInput.value = "";
            amountInput.disabled = difficultyMode === "hard" ? true : true; // will be re-enabled on check
            const recipeInfo = recipeMap.get(ingredientId);
            unitSpan.textContent = recipeInfo ? recipeInfo.unit : "";
        });

        updateModeUI();
    }

    function evaluateEasyMode() {
        const recipeIds = new Set(
            currentRecipe.ingredients.map((ing) => ing.ingredientId)
        );

        const selectedIds = new Set(
            Array.from(
                ingredientsListEl.querySelectorAll(".ingredient-checkbox:checked")
            ).map((cb) => cb.closest(".ingredient-card").dataset.ingredientId)
        );

        const missing = [];
        const extra = [];
        const correct = [];

        recipeIds.forEach((id) => {
            if (selectedIds.has(id)) {
                correct.push(id);
            } else {
                missing.push(id);
            }
        });

        selectedIds.forEach((id) => {
            if (!recipeIds.has(id)) {
                extra.push(id);
            }
        });

        const isPerfect = missing.length === 0 && extra.length === 0;

        let html = `<h2>Result (Easy Mode)</h2>`;
        html += `<p class="${isPerfect ? "success" : "error"}">`;

        if (isPerfect) {
            html += "Perfect! You picked all the correct ingredients.";
        } else {
            html += "Not quite. Here's how you did:";
        }
        html += "</p>";

        if (correct.length > 0) {
            html += "<h3>✅ Correct ingredients</h3><ul>";
            correct.forEach((id) => {
                html += `<li>${getIngredientName(id)}</li>`;
            });
            html += "</ul>";
        }

        if (missing.length > 0) {
            html += "<h3>⚠️ Missing ingredients</h3><ul>";
            missing.forEach((id) => {
                html += `<li>${getIngredientName(id)}</li>`;
            });
            html += "</ul>";
        }

        if (extra.length > 0) {
            html += "<h3>❌ Extra ingredients</h3><ul>";
            extra.forEach((id) => {
                html += `<li>${getIngredientName(id)}</li>`;
            });
            html += "</ul>";
        }

        feedbackEl.innerHTML = html;
    }

    function evaluateHardMode() {
        const recipeMap = new Map();
        currentRecipe.ingredients.forEach((ri) =>
            recipeMap.set(ri.ingredientId, ri)
        );

        const selectedCards = Array.from(
            ingredientsListEl.querySelectorAll(".ingredient-checkbox:checked")
        ).map((cb) => cb.closest(".ingredient-card"));

        const selectedMap = new Map();
        selectedCards.forEach((card) => {
            const id = card.dataset.ingredientId;
            const amountInput = card.querySelector(".ingredient-amount");
            const raw = amountInput.value.trim();
            const amount = raw === "" ? NaN : parseFloat(raw);
            selectedMap.set(id, { amount, raw });
        });

        const correct = [];
        const missing = [];
        const wrongAmounts = [];
        const extra = [];

        recipeMap.forEach((recipeIng, id) => {
            if (!selectedMap.has(id)) {
                missing.push(recipeIng);
            } else {
                const user = selectedMap.get(id);
                if (Number.isNaN(user.amount)) {
                    wrongAmounts.push({
                        ingredientId: id,
                        userAmount: user.raw || "(no amount)",
                        recipeAmount: recipeIng.amount,
                        unit: recipeIng.unit
                    });
                } else if (!amountEquals(user.amount, recipeIng.amount)) {
                    wrongAmounts.push({
                        ingredientId: id,
                        userAmount: user.amount,
                        recipeAmount: recipeIng.amount,
                        unit: recipeIng.unit
                    });
                } else {
                    correct.push(recipeIng);
                }
            }
        });

        selectedMap.forEach((_user, id) => {
            if (!recipeMap.has(id)) {
                extra.push(id);
            }
        });

        const isPerfect =
            correct.length === recipeMap.size &&
            wrongAmounts.length === 0 &&
            missing.length === 0 &&
            extra.length === 0;

        let html = `<h2>Result (Hard Mode)</h2>`;
        html += `<p class="${isPerfect ? "success" : "error"}">`;

        if (isPerfect) {
            html += "Perfect! You nailed both ingredients and their amounts.";
        } else {
            html += "Not quite. Here's the breakdown:";
        }
        html += "</p>";

        if (correct.length > 0) {
            html += "<h3>✅ Correct ingredients and amounts</h3><ul>";
            correct.forEach((ri) => {
                html += `<li>${getIngredientName(ri.ingredientId)}: ${ri.amount} ${ri.unit
                    }</li>`;
            });
            html += "</ul>";
        }

        if (wrongAmounts.length > 0) {
            html += "<h3>❌ Wrong amounts</h3><ul>";
            wrongAmounts.forEach((wa) => {
                html += `<li>${getIngredientName(wa.ingredientId)}: you used ${wa.userAmount
                    }, correct is ${wa.recipeAmount} ${wa.unit}</li>`;
            });
            html += "</ul>";
        }

        if (missing.length > 0) {
            html += "<h3>⚠️ Missing ingredients</h3><ul>";
            missing.forEach((ri) => {
                html += `<li>${getIngredientName(ri.ingredientId)}: should be ${ri.amount
                    } ${ri.unit}</li>`;
            });
            html += "</ul>";
        }

        if (extra.length > 0) {
            html += "<h3>❌ Extra ingredients</h3><ul>";
            extra.forEach((id) => {
                html += `<li>${getIngredientName(id)}</li>`;
            });
            html += "</ul>";
        }

        feedbackEl.innerHTML = html;
    }

    function getRandomRecipe() {
        const index = Math.floor(Math.random() * recipes.length);
        return recipes[index];
    }

    function getIngredientName(id) {
        const ing = allIngredients.find((i) => i.id === id);
        return ing ? ing.displayName : id;
    }

    function amountEquals(a, b) {
        return Math.abs(a - b) < 1e-6;
    }

    function clearFeedback() {
        feedbackEl.innerHTML = "";
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
});
