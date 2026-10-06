import os
import random
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from flask import Flask, jsonify, render_template, request

POKEAPI = "https://pokeapi.co/api/v2/pokemon"
CACHE_SECONDS = 60 * 60
MAX_LIMIT = 50
OWNER = os.environ.get("OWNER_NAME", "Elvis Mutangana")

app = Flask(__name__)
app.json.sort_keys = False

started_at = time.time()
cache = {}
session = requests.Session()


class PokeApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def fetch(url):
    """GET a PokéAPI URL, keeping the JSON in memory for an hour."""
    hit = cache.get(url)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]

    try:
        response = session.get(url, timeout=10)
    except requests.RequestException:
        raise PokeApiError(502, "Could not reach PokéAPI")

    if response.status_code == 404:
        raise PokeApiError(404, "Pokémon not found")
    if not response.ok:
        raise PokeApiError(502, f"PokéAPI returned {response.status_code}")

    data = response.json()
    cache[url] = (time.time(), data)
    return data


def summarize(data):
    """Trim PokéAPI's large response down to what a client needs."""
    abilities = [a["ability"]["name"] for a in data["abilities"]]
    artwork = data["sprites"]["other"]["official-artwork"]["front_default"]
    return {
        "id": data["id"],
        "name": data["name"],
        "image": artwork or data["sprites"]["front_default"],
        "types": [t["type"]["name"] for t in data["types"]],
        "abilities": abilities,
        # PokéAPI gives height in decimetres and weight in hectograms
        "height_m": data["height"] / 10,
        "weight_kg": data["weight"] / 10,
        "stats": {s["stat"]["name"]: s["base_stat"] for s in data["stats"]},
        "message": f"I am {data['name']} and I have {abilities[0]}.",
    }


def read_int(name, default, low, high):
    try:
        value = int(request.args.get(name, default))
    except ValueError:
        value = default
    return max(low, min(value, high))


@app.after_request
def allow_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.errorhandler(PokeApiError)
def pokeapi_error(error):
    return jsonify(error=error.message, status=error.status), error.status


@app.errorhandler(404)
def not_found(error):
    return jsonify(error="Route not found", status=404, see="/"), 404


@app.route("/")
def home():
    return render_template("index.html", owner=OWNER)


@app.route("/name")
def name():
    return jsonify(name=OWNER, service="pokemon-flask-api")


@app.route("/health")
def health():
    return jsonify(
        status="ok",
        uptime_seconds=round(time.time() - started_at),
        cached_responses=len(cache),
    )


@app.route("/api/pokemon")
def pokemon_list():
    limit = read_int("limit", 20, 1, MAX_LIMIT)
    offset = read_int("offset", 0, 0, 100000)
    page = fetch(f"{POKEAPI}?limit={limit}&offset={offset}")

    with ThreadPoolExecutor(max_workers=10) as pool:
        details = list(pool.map(fetch, [item["url"] for item in page["results"]]))

    return jsonify(
        count=page["count"],
        limit=limit,
        offset=offset,
        next=offset + limit if page["next"] else None,
        previous=max(0, offset - limit) if page["previous"] else None,
        results=[summarize(d) for d in details],
    )


@app.route("/api/pokemon/<name_or_id>")
def pokemon_detail(name_or_id):
    return jsonify(summarize(fetch(f"{POKEAPI}/{name_or_id.strip().lower()}")))


@app.route("/api/random")
def pokemon_random():
    count = fetch(f"{POKEAPI}?limit=1")["count"]
    # Ids above the base species jump to 10001+, so pick from the first 1025
    pokemon_id = random.randint(1, min(count, 1025))
    return jsonify(summarize(fetch(f"{POKEAPI}/{pokemon_id}")))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
