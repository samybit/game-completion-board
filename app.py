from flask import Flask, render_template, request, jsonify
import sqlite3
import json
import os
import requests
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# --- 1. Setup Gemini AI ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # Set the System Prompt directly in the model
    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        system_instruction="You are a helpful video game assistant. Your job is to list achievements for games or answer questions about specific game milestones. Keep answers concise and format lists clearly using markdown bullet points.",
    )

app = Flask(__name__)


def init_db():
    # Create games.db if doesn't exist
    conn = sqlite3.connect("games.db")
    c = conn.cursor()

    c.execute("""CREATE TABLE IF NOT EXISTS games 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  title TEXT, 
                  achievements TEXT,
                  image_url TEXT)""")
    conn.commit()
    conn.close()


@app.route("/")
def index():
    return render_template("index.html")


# ---  CheapShark API ---
@app.route("/api/search_image")
def search_image():
    query = request.args.get("q")
    if not query:
        return jsonify({"image_url": None})

    url = f"https://www.cheapshark.com/api/1.0/games?title={query}&limit=1"
    try:
        resp = requests.get(url)
        data = resp.json()
        if data and len(data) > 0:
            img_url = data[0].get("thumb")
            # FIX: CheapShark sometimes forgets the 'https:' part of the URL!
            if img_url and img_url.startswith("//"):
                img_url = "https:" + img_url
            return jsonify({"image_url": img_url})
    except Exception as e:
        print("Error fetching from CheapShark:", e)

    return jsonify({"image_url": None})


@app.route("/api/games", methods=["GET"])
def get_games():
    conn = sqlite3.connect("games.db")
    c = conn.cursor()
    c.execute("SELECT id, title, achievements, image_url FROM games")
    rows = c.fetchall()
    conn.close()

    # Format the data to send back to JavaScript
    games = []
    for row in rows:
        games.append(
            {
                "id": row[0],
                "title": row[1],
                "achievements": json.loads(row[2]),
                "image_url": row[3],
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
    image_url = data.get("image_url", "")

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

        max_id = (
            max([ach["id"] for ach in existing_achievements])
            if existing_achievements
            else 0
        )
        for ach in new_achievements:
            max_id += 1
            ach["id"] = max_id
            existing_achievements.append(ach)

        achievements_str = json.dumps(existing_achievements)

        c.execute(
            "UPDATE games SET achievements = ?, image_url = ? WHERE id = ?",
            (achievements_str, image_url, game_id),
        )
        conn.commit()
        conn.close()

        return jsonify(
            {
                "id": game_id,
                "title": title,
                "achievements": existing_achievements,
                "image_url": image_url,
                "is_update": True,
            }
        )

    else:
        # BRAND NEW GAME: Insert normally
        achievements_str = json.dumps(new_achievements)
        c.execute(
            "INSERT INTO games (title, achievements, image_url) VALUES (?, ?, ?)",
            (title, achievements_str, image_url),
        )
        new_id = c.lastrowid
        conn.commit()
        conn.close()

        return jsonify(
            {
                "id": new_id,
                "title": title,
                "achievements": new_achievements,
                "image_url": image_url,
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


# --- 3. Chat Route using Gemini ---
@app.route("/api/chat", methods=["POST"])
def chat_with_ai():
    data = request.json
    user_message = data.get("message")

    # Receive past history so the AI remembers the conversation
    chat_history = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    try:
        # Convert your Javascript history array into the format Gemini expects
        gemini_history = []
        for msg in chat_history:
            # Gemini uses 'user' and 'model' instead of 'user' and 'assistant'
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})

        # Load the memory and send the new message
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(user_message)

        return jsonify({"reply": response.text})
    except Exception as e:
        print(f"Gemini Error: {e}")
        return jsonify({"error": "Failed to connect to the AI."}), 500


@app.route("/test")
def run_tests():
    # Serve our Mocha testing page
    return render_template("test.html")


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
