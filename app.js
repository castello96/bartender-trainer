document.addEventListener("DOMContentLoaded", () => {
    const ingredientsListEl = document.getElementById("ingredients-list");
    const cocktailNameEl = document.getElementById("current-cocktail-name");
    const statusEl = document.getElementById("status-message");
    const feedbackEl = document.getElementById("feedback");
    const nextCocktailBtn = document.getElementById("next-cocktail-btn");
    const checkBtn = document.getElementById("check-btn");
    const modeButtons = document.querySelectorAll(".mode-btn");

    let allIngredients = [];
    let recipes = [];
    let currentRecipe = null;
    let currentMode = "easy";
    let configsLoaded = false;

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
                renderIngredientsList();
            })
            .catch((err) => {
                console.error("Error loading configs:", err);
                statusEl.textContent =
                    "Error loading configuration files. Make sure they exist and are valid JSON.";
            });
    }

    function renderIngredientsList() {
        ingredientsListEl.innerHTML = "";

        allIngredients.forEach((ing) => {
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
            <input type="number"
                   class="ingredient-amount"
                   min="0"
                   step="0.25"
                   placeholder="0" />
            <span class="ingredient-unit"></span>
          </div>
        </div>
      `;

            const checkbox = card.querySelector(".ingredient-checkbox");
            const amountInput = card.querySelector(".ingredient-amount");

            // Disable/enable amount input based on checkbox in Hard mode
            checkbox.addEventListener("change", () => {
                if (currentMode === "hard") {
                    amountInput.disabled = !checkbox.checked;
                    if (!checkbox.checked) {
                        amountInput.value = "";
                    }
                }
            });

            ingredientsListEl.appendChild(card);
        });

        updateModeUI();
    }

    function updateModeUI() {
        const cards = ingredientsListEl.querySelectorAll(".ingredient-card");
        cards.forEach((card) => {
            const amountRow = card.querySelector(".amount-row");
            const amountInput = card.querySelector(".ingredient-amount");
            const checkbox = card.querySelector(".ingredient-checkbox");

            if (currentMode === "easy") {
                amountRow.style.display = "none";
                amountInput.value = "";
                amountInput.disabled = true;
            } else {
                amountRow.style.display = "flex";
                amountInput.disabled = !checkbox.checked;
            }
        });
    }

    // Mode buttons
    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            if (mode === currentMode) return;

            currentMode = mode;
            modeButtons.forEach((b) => {
                b.classList.toggle("active", b === btn);
            });

            updateModeUI();
            clearFeedback();

            if (currentRecipe) {
                statusEl.textContent = `Mode changed to ${capitalize(
                    currentMode
                )}. Current cocktail: ${currentRecipe.name}.`;
            } else {
                statusEl.textContent = `Mode changed to ${capitalize(
                    currentMode
                )}. Click "New Cocktail" to start.`;
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
        statusEl.textContent =
            "Select the ingredients you think belong in this cocktail" +
            (currentMode === "hard" ? " and their amounts." : ".");
        resetSelectionsForNewRecipe();
        clearFeedback();
        checkBtn.disabled = false;
    });

    // Check button
    checkBtn.addEventListener("click", () => {
        if (!currentRecipe) {
            statusEl.textContent = 'No cocktail selected. Click "New Cocktail" first.';
            return;
        }

        if (currentMode === "easy") {
            evaluateEasyMode();
        } else {
            evaluateHardMode();
        }
    });

    function resetSelectionsForNewRecipe() {
        const cards = ingredientsListEl.querySelectorAll(".ingredient-card");

        // Build quick lookup of recipe ingredients
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
            amountInput.disabled = currentMode === "hard"; // start disabled until checked
            const recipeInfo = recipeMap.get(ingredientId);
            unitSpan.textContent = recipeInfo ? recipeInfo.unit : "";
        });
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

        // Recipe ingredients: check for missing or wrong amount
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

        // Extra ingredients: selected but not in recipe
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
        // Simple exact compare with tiny tolerance
        return Math.abs(a - b) < 1e-6;
    }

    function clearFeedback() {
        feedbackEl.innerHTML = "";
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
});
