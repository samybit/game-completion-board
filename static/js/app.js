// --- CORE LOGIC ---
class GameManager {
    constructor() {
        this.games = [];
        this.loadData();
        this.setupThumbnailFetcher();

        // Listen for form submission
        const form = document.getElementById('add-game-form');
        if (form) {
            // use bind(this) so 'this' inside addGame still refers to the GameManager
            form.addEventListener('submit', this.addGame.bind(this));

            // Listen for Ctrl + Enter in the textarea
            const achievementsInput = document.getElementById('game-achievements');
            if (achievementsInput) {
                achievementsInput.addEventListener('keydown', (event) => {
                    // Check if Ctrl (or Cmd on Mac) AND Enter are pressed
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault(); // Stop it from just adding a new line
                        form.requestSubmit();   // Fire the form submission natively
                    }
                });
            }
        }
    }

    // Fetch data from Flask
    async loadData() {
        try {
            const response = await fetch('/api/games');
            this.games = await response.json();
            this.render();
        } catch (error) {
            console.error("Error loading data:", error);
        }
    }

    calculateProgress(achievements) {
        if (achievements.length === 0) return 0;
        const completed = achievements.filter(a => a.completed).length;
        return Math.round((completed / achievements.length) * 100);
    }

    async toggleAchievement(gameId, achId) {
        // Find the game and achievement in our local state
        const game = this.games.find(g => g.id === gameId);
        const achievement = game.achievements.find(a => a.id === achId);
        achievement.completed = !achievement.completed; // Toggle it

        this.render(); // Update the UI immediately

        // Send the update to Flask/SQLite
        try {
            await fetch(`/api/games/${gameId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ achievements: game.achievements })
            });
        } catch (error) {
            console.error("Error saving data:", error);
        }
    }

    // DOM MANIPULATION
    render(newGameId = null) {
        const container = document.getElementById('game-container');
        if (!container) return;

        container.innerHTML = '';

        this.games.forEach(game => {
            const progress = this.calculateProgress(game.achievements);

            // Logic to determine bar color based on completion
            const barColorClass = progress === 100 ? 'bg-success shadow-[0_0_10px_#03dac6]' : 'bg-brand';

            const gameCard = document.createElement('div');

            const isNew = game.id === newGameId;

            // Tailwind Card Styling with hover lift
            gameCard.className = `relative bg-surface p-6 rounded-xl shadow-lg border border-gray-800 flex flex-col h-full transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-gray-600 ${isNew ? 'slash-drop-animation' : ''}`;

            gameCard.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-xl font-bold text-gray-100 leading-tight">${game.title}</h2>
                    <button onclick="app.deleteGame(${game.id})" class="text-gray-500 hover:text-red-400 transition-colors p-1" title="Delete Game">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>

                <div class="flex justify-between items-end mb-2">
                    <span class="text-sm font-medium text-gray-400 uppercase tracking-wider">Completion</span>
                    <span class="text-2xl font-extrabold ${progress === 100 ? 'text-success drop-shadow-md' : 'text-brand'}">${progress}%</span>
                </div>

                <div class="w-full bg-gray-800 rounded-full h-2.5 mb-6 overflow-hidden">
                    <div class="h-2.5 rounded-full transition-all duration-700 ease-out ${barColorClass}" style="width: ${progress}%"></div>
                </div>

                <ul class="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    ${game.achievements.map(ach => `
                        <li class="flex items-center gap-3 group cursor-pointer" onclick="app.toggleAchievement(${game.id}, ${ach.id})">
                            <div class="relative flex items-center justify-center w-5 h-5 rounded border ${ach.completed ? 'border-success bg-success' : 'border-gray-500 group-hover:border-brand'} transition-colors duration-200">
                                ${ach.completed ? `<svg class="w-3.5 h-3.5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>` : ''}
                            </div>
                            <span class="select-none transition-all duration-200 ${ach.completed ? 'text-gray-500 line-through' : 'text-gray-300 group-hover:text-white'}">
                                ${ach.name}
                            </span>
                        </li>
                    `).join('')}
                </ul>
            `;
            container.appendChild(gameCard);
        });
    }

    async addGame(event) {
        event.preventDefault(); // Stop the page from reloading

        const titleInput = document.getElementById('game-title');
        const achievementsInput = document.getElementById('game-achievements');

        // Split the textarea by new lines, remove empty lines, and format as objects
        const achievementsList = achievementsInput.value
            .split('\n')
            .filter(line => line.trim() !== '')
            .map((name, index) => ({
                id: index + 1,
                name: name.trim(),
                completed: false
            }));

        const newGameData = {
            title: titleInput.value.trim(),
            achievements: achievementsList
        };

        try {
            // Send the POST request to Flask
            const response = await fetch('/api/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newGameData)
            });

            const savedGame = await response.json();

            if (savedGame.is_update) {
                // If it's an update, find the existing game and replace its data
                const existingIndex = this.games.findIndex(g => g.id === savedGame.id);
                if (existingIndex !== -1) {
                    this.games[existingIndex] = savedGame;
                }
                if (this.showToast) this.showToast("Achievements merged into existing game!");
                // Redraw normally without the slash animation since it already exists
                this.render();
            } else {
                // Add the new game to our local array
                this.games.push(savedGame);
                if (this.showToast) this.showToast("New game successfully added!");
                // Pass the new ID to trigger the sword slash and drop!
                this.render(savedGame.id);
            }

            // Clear the form
            titleInput.value = '';
            achievementsInput.value = '';
        } catch (error) {
            console.error("Error adding game:", error);
        }
    }

    async deleteGame(gameId) {
        // Ask for confirmation before deleting
        if (!confirm("Are you sure you want to delete this game?")) return;

        try {
            // Send the DELETE request to Flask
            await fetch(`/api/games/${gameId}`, {
                method: 'DELETE'
            });

            // Remove the game from our local array
            this.games = this.games.filter(game => game.id !== gameId);

            // Update the UI
            this.render();

            this.showToast("Game deleted.");
        } catch (error) {
            console.error("Error deleting game:", error);
        }
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');

        toastMessage.innerText = message;

        // Tailwind animation classes: remove translate-y-24 and opacity-0, add normal states
        toast.classList.remove('translate-y-24', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-24', 'opacity-0');
        }, 3000);
    }

    setupThumbnailFetcher() {
        const titleInput = document.getElementById('game-title');
        const thumbnailImg = document.getElementById('game-thumbnail');
        let debounceTimer;

        const rawgApiKey = 'YOUR_RAWG_API_KEY';

        if (titleInput && thumbnailImg) {
            titleInput.addEventListener('input', (event) => {
                // Clear the timer every time a key is pressed
                clearTimeout(debounceTimer);
                const query = event.target.value.trim();

                // Hide the image if the box is empty or word is too short
                if (query.length < 3) {
                    thumbnailImg.classList.add('hidden');
                    return;
                }

                // Show a loading state
                thumbnailImg.src = "https://placehold.co/32?text=...";
                thumbnailImg.classList.remove('hidden');

                // Wait 500ms after the user stops typing
                debounceTimer = setTimeout(async () => {
                    try {
                        const response = await fetch(`https://api.rawg.io/api/games?key=${rawgApiKey}&search=${encodeURIComponent(query)}&page_size=1`);
                        const data = await response.json();

                        // If the API found the game and it has an image
                        if (data.results && data.results.length > 0 && data.results[0].background_image) {
                            thumbnailImg.src = data.results[0].background_image;
                            thumbnailImg.classList.remove('animate-pulse'); // Stop loading animation
                        } else {
                            thumbnailImg.classList.add('hidden'); // Hide if no game found
                        }
                    } catch (error) {
                        console.error("Error fetching game art:", error);
                        thumbnailImg.classList.add('hidden');
                    }
                }, 500);
            });
        }
    }
}

// Initialize the app
const app = new GameManager();
// Expose calculating logic for Mocha testing
window.calculateProgress = app.calculateProgress;
document.addEventListener('DOMContentLoaded', () => app.render());