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
    title = data["title"]
    achievements_str = json.dumps(data["achievements"])

    conn = sqlite3.connect("games.db")
    c = conn.cursor()
    c.execute(
        "INSERT INTO games (title, achievements) VALUES (?, ?)",
        (title, achievements_str),
    )
    new_id = c.lastrowid  # Get the ID of the game we just inserted
    conn.commit()
    conn.close()

    # Return the new game so JS can add it to the UI immediately
    return jsonify({"id": new_id, "title": title, "achievements": data["achievements"]})


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
