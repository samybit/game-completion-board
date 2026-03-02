from flask import Flask, render_template, request, jsonify
import sqlite3
import json

app = Flask(__name__)


def init_db():
    # This creates the games.db file if it doesn't exist
    conn = sqlite3.connect("games.db")
    c = conn.cursor()
    # We will store the achievements as a JSON string in the database for simplicity right now
    c.execute("""CREATE TABLE IF NOT EXISTS games 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  title TEXT, 
                  achievements TEXT)""")

    # Insert a default game if the table is empty
    c.execute("SELECT COUNT(*) FROM games")
    if c.fetchone()[0] == 0:
        default_achievements = json.dumps(
            [
                {"id": 1, "name": "Defeat Kuze", "completed": True},
                {"id": 2, "name": "Real Estate Royale", "completed": False},
            ]
        )
        c.execute(
            "INSERT INTO games (title, achievements) VALUES (?, ?)",
            ("Yakuza 0", default_achievements),
        )
        conn.commit()
    conn.close()


@app.route("/")
def index():
    # Serve your index.html
    return render_template("index.html")


@app.route("/api/games", methods=["GET"])
def get_games():
    conn = sqlite3.connect("games.db")
    c = conn.cursor()
    c.execute("SELECT id, title, achievements FROM games")
    rows = c.fetchall()
    conn.close()

    # Format the data to send back to JavaScript
    games = []
    for row in rows:
        games.append(
            {
                "id": row[0],
                "title": row[1],
                "achievements": json.loads(row[2]),  # Convert string back to JSON
            }
        )
    return jsonify(games)


@app.route("/api/games/<int:game_id>", methods=["PUT"])
def update_game(game_id):
    data = request.json
    achievements_str = json.dumps(data["achievements"])

    conn = sqlite3.connect("games.db")
    c = conn.cursor()
    c.execute(
        "UPDATE games SET achievements = ? WHERE id = ?", (achievements_str, game_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"status": "success"})


@app.route("/api/games", methods=["POST"])
def add_game():
    data = request.json
    # Split by any whitespace and rejoin with a single space
    title = " ".join(data["title"].split())
    new_achievements = data["achievements"]

    conn = sqlite3.connect("games.db")
    c = conn.cursor()

    # Check if the game already exists (case-insensitive)
    c.execute(
        "SELECT id, achievements FROM games WHERE LOWER(title) = LOWER(?)", (title,)
    )
    existing_game = c.fetchone()

    if existing_game:
        # GAME EXISTS: Merge the achievements
        game_id = existing_game[0]
        existing_achievements = json.loads(existing_game[1])

        # Find the highest achievement ID so we don't create duplicates
        max_id = 0
        if existing_achievements:
            max_id = max([ach["id"] for ach in existing_achievements])

        # Assign new unique IDs to the incoming achievements
        for ach in new_achievements:
            max_id += 1
            ach["id"] = max_id
            existing_achievements.append(ach)

        achievements_str = json.dumps(existing_achievements)

        c.execute(
            "UPDATE games SET achievements = ? WHERE id = ?",
            (achievements_str, game_id),
        )
        conn.commit()
        conn.close()

        return jsonify(
            {
                "id": game_id,
                "title": title,
                "achievements": existing_achievements,
                "is_update": True,  # Tell JavaScript this was an update
            }
        )

    else:
        # BRAND NEW GAME: Insert normally
        achievements_str = json.dumps(new_achievements)
        c.execute(
            "INSERT INTO games (title, achievements) VALUES (?, ?)",
            (title, achievements_str),
        )
        new_id = c.lastrowid
        conn.commit()
        conn.close()

        return jsonify(
            {
                "id": new_id,
                "title": title,
                "achievements": new_achievements,
                "is_update": False,
            }
        )


@app.route("/api/games/<int:game_id>", methods=["DELETE"])
def delete_game(game_id):
    conn = sqlite3.connect("games.db")
    c = conn.cursor()
    c.execute("DELETE FROM games WHERE id = ?", (game_id,))
    conn.commit()
    conn.close()

    return jsonify({"status": "deleted", "id": game_id})


@app.route("/test")
def run_tests():
    # Serve our Mocha testing page
    return render_template("test.html")


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
