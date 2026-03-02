// --- CORE LOGIC ---
class GameManager {
    constructor() {
        this.games = [];
        this.loadData(); // Fetch data from Flask sqlite

        // Listen for form submission
        const form = document.getElementById('add-game-form');
        if (form) {
            // use bind(this) so 'this' inside addGame still refers to the GameManager
            form.addEventListener('submit', this.addGame.bind(this));
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
    render() {
        const container = document.getElementById('game-container');
        if (!container) return;

        container.innerHTML = '';

        this.games.forEach(game => {
            const progress = this.calculateProgress(game.achievements);

            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.innerHTML = `
                <h2>
                ${game.title} 
                    <div>
                        <span class="progress" style="margin-right: 10px;">${progress}%</span>
                        <button onclick="app.deleteGame(${game.id})" style="background: #cf6679; color: #000; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Delete</button>
                    </div>
                </h2>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <ul class="achievement-list">
                    ${game.achievements.map(ach => `
                        <li class="${ach.completed ? 'completed' : ''}">
                            <input type="checkbox" 
                                ${ach.completed ? 'checked' : ''} 
                                onchange="app.toggleAchievement(${game.id}, ${ach.id})">
                            ${ach.name}
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

            // Add the new game to our local array and re-render the UI
            this.games.push(savedGame);
            this.render();

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
        } catch (error) {
            console.error("Error deleting game:", error);
        }
    }
}

// Initialize the app
const app = new GameManager();
// Expose calculating logic for Mocha testing
window.calculateProgress = app.calculateProgress;
document.addEventListener('DOMContentLoaded', () => app.render());