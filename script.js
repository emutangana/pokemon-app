const API_URL = "https://pokeapi.co/api/v2/pokemon";
const LIMIT = 20;

const TYPE_COLORS = {
  normal: "#a8a77a",
  fire: "#ee8130",
  water: "#6390f0",
  electric: "#d4b000",
  grass: "#5fa83a",
  ice: "#5fbfbb",
  fighting: "#c22e28",
  poison: "#a33ea1",
  ground: "#c7a24a",
  flying: "#8f7ae0",
  psychic: "#f95587",
  bug: "#8a9a1a",
  rock: "#b6a136",
  ghost: "#735797",
  dragon: "#6f35fc",
  dark: "#705746",
  steel: "#8e8ea8",
  fairy: "#d685ad",
};

const grid = document.getElementById("grid");
const statusText = document.getElementById("status");
const searchInput = document.getElementById("search");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const pageInfo = document.getElementById("page-info");
const message = document.getElementById("message");

let offset = 0;
let total = 0;
let pokemonList = [];
let messageTimer;

async function loadPage() {
  statusText.textContent = "Loading Pokémon...";
  statusText.hidden = false;
  grid.innerHTML = "";
  prevBtn.disabled = true;
  nextBtn.disabled = true;

  try {
    const response = await fetch(`${API_URL}?limit=${LIMIT}&offset=${offset}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    total = data.count;

    pokemonList = await Promise.all(
      data.results.map((item) =>
        fetch(item.url).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
      )
    );

    statusText.hidden = true;
    renderCards();
  } catch (error) {
    statusText.textContent = "Could not load Pokémon. Please try again later.";
    console.error(error);
  }

  updatePagination();
}

function renderCards() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = pokemonList.filter((pokemon) =>
    pokemon.name.includes(query)
  );

  grid.innerHTML = "";

  if (filtered.length === 0) {
    statusText.textContent = `No Pokémon on this page match "${searchInput.value}".`;
    statusText.hidden = false;
    return;
  }

  statusText.hidden = true;
  filtered.forEach((pokemon, index) => {
    grid.appendChild(createCard(pokemon, index));
  });
}

function createCard(pokemon, index) {
  const card = document.createElement("article");
  card.className = "card";
  card.style.animationDelay = `${index * 30}ms`;

  const mainType = pokemon.types[0].type.name;
  card.style.setProperty("--type-color", TYPE_COLORS[mainType] || "#a8a77a");

  const image =
    pokemon.sprites.other["official-artwork"].front_default ||
    pokemon.sprites.front_default;

  const id = document.createElement("span");
  id.className = "card-id";
  id.textContent = `#${String(pokemon.id).padStart(3, "0")}`;

  const img = document.createElement("img");
  img.className = "card-img";
  img.src = image;
  img.alt = pokemon.name;
  img.loading = "lazy";

  const name = document.createElement("h2");
  name.className = "card-name";
  name.textContent = pokemon.name;

  const types = document.createElement("div");
  types.className = "types";
  pokemon.types.forEach((t) => {
    const badge = document.createElement("span");
    badge.className = "type";
    badge.textContent = t.type.name;
    types.appendChild(badge);
  });

  // PokéAPI gives height in decimetres and weight in hectograms
  const stats = document.createElement("p");
  stats.className = "stats";
  stats.textContent = `${pokemon.height / 10} m · ${pokemon.weight / 10} kg`;

  const button = document.createElement("button");
  button.className = "card-btn";
  button.textContent = "Ability";
  button.addEventListener("click", () => showAbility(pokemon));

  card.append(id, img, name, types, stats, button);
  return card;
}

function showAbility(pokemon) {
  const ability = pokemon.abilities[0].ability.name;
  message.textContent = `I am ${pokemon.name} and I have ${ability}.`;
  message.hidden = false;

  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    message.hidden = true;
  }, 3000);
}

function updatePagination() {
  const page = Math.floor(offset / LIMIT) + 1;
  const totalPages = Math.ceil(total / LIMIT) || 1;
  pageInfo.textContent = `Page ${page} of ${totalPages}`;
  prevBtn.disabled = offset === 0;
  nextBtn.disabled = offset + LIMIT >= total;
}

searchInput.addEventListener("input", renderCards);

prevBtn.addEventListener("click", () => {
  offset = Math.max(0, offset - LIMIT);
  loadPage();
});

nextBtn.addEventListener("click", () => {
  offset += LIMIT;
  loadPage();
});

loadPage();
