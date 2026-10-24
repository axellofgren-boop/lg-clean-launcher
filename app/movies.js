// "What do we watch?" - suggests well-rated films and series that are
// streaming in Denmark on Netflix, HBO Max or Disney+.
//
// Where the data comes from (both free, both need a personal key):
//   - TMDB (themoviedb.org): which titles exist, their posters, their rating,
//     and which streaming service has them in Denmark (that part comes from
//     JustWatch, through TMDB).
//   - OMDb (omdbapi.com), optional: the Rotten Tomatoes and IMDb scores.
// The keys live in movie-keys.js (kept out of GitHub) or are typed in on the
// TV's "Movie keys" screen and remembered on the TV.

var MOVIE_KEYS_STORE = "goblinMansion.movieKeys";
var MOVIE_SEEN_STORE = "goblinMansion.moviesSeen";
var MOVIE_PROVIDERS_STORE = "goblinMansion.movieProviders";
var TMDB = "https://api.themoviedb.org/3";
var POSTER = "https://image.tmdb.org/t/p/w342";
var REGION = "DK";
var PICKS = 5;

// The services you have. `match` finds them in TMDB's list of Danish
// services; `app` is the tile name in apps.js, used to open the app.
var SERVICES = [
  { name: "Netflix", match: /^netflix$/i,              app: "Netflix", logo: "logos/netflix.svg",    background: "#000000" },
  { name: "HBO Max", match: /^(hbo max|max)$/i,        app: "HBO Max", logo: "logos/hbo.svg",        background: "linear-gradient(135deg, #002be7, #6a00d9)" },
  { name: "Disney+", match: /^disney ?(\+|plus)$/i,    app: "Disney+", logo: "logos/disneyplus.png", background: "linear-gradient(135deg, #0a1446, #143c9e 55%, #1b8fbf)" }
];

// Moods to pick from. TMDB numbers its genres differently for films and
// series; a mood with no series number is only offered for films.
var MOODS = [
  { name: "Anything" },
  { name: "Funny",       movie: "35",    tv: "35" },
  { name: "Action",      movie: "28|12", tv: "10759" },
  { name: "Scary",       movie: "27" },
  { name: "Romantic",    movie: "10749" },
  { name: "Animated",    movie: "16",    tv: "16" },
  { name: "Family",      movie: "10751", tv: "10751" },
  { name: "Sci-fi",      movie: "878|14", tv: "10765" },
  { name: "Crime",       movie: "80|53", tv: "80" },
  { name: "Drama",       movie: "18",    tv: "18" },
  { name: "True stories", movie: "99",   tv: "99" }
];

// Small pictures for the score badges (the TV may not have emoji).
var TOMATO = '<svg viewBox="0 0 32 32" width="30" height="30"><circle cx="16" cy="18" r="12" fill="#fa320a"/>' +
  '<path d="M16 7c-2-3-6-3-8-1 3 0 5 1 6 3-3-1-6 0-7 2 3-1 6-1 9 0 3-1 6-1 9 0-1-2-4-3-7-2 1-2 3-3 6-3-2-2-6-2-8 1z" fill="#00912d"/></svg>';
var STAR = '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M16 3l4 8.5 9.3 1.2-6.8 6.4 1.7 9.2L16 23.8l-8.2 4.5 1.7-9.2-6.8-6.4L12 11.5z" fill="#ffd36e"/></svg>';
var DICE = '<svg viewBox="0 0 32 32" width="30" height="30"><rect x="3" y="3" width="26" height="26" rx="6" fill="#ff8fd8"/>' +
  '<g fill="#140f1c"><circle cx="10" cy="10" r="2.6"/><circle cx="22" cy="10" r="2.6"/><circle cx="16" cy="16" r="2.6"/><circle cx="10" cy="22" r="2.6"/><circle cx="22" cy="22" r="2.6"/></g></svg>';

var movies = null; // the picker's state while it's open

// ---------- Keys ----------

function movieKeys() {
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(MOVIE_KEYS_STORE)) || {}; } catch (e) {}
  var built = typeof MOVIE_KEYS !== "undefined" ? MOVIE_KEYS : {};
  return { tmdb: saved.tmdb || built.tmdb || "", omdb: saved.omdb || built.omdb || "" };
}

function saveMovieKeys(keys) {
  try { localStorage.setItem(MOVIE_KEYS_STORE, JSON.stringify(keys)); } catch (e) {}
}

// ---------- Asking the internet ----------

function getJson(url, done) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.timeout = 15000;
  xhr.onload = function () {
    var data = null;
    try { data = JSON.parse(xhr.responseText); } catch (e) {}
    if (xhr.status === 200 && data) done(null, data);
    else if (xhr.status === 401) done("The TMDB key wasn't accepted. Check it on the Movie keys screen.");
    else done("TMDB answered " + xhr.status + ".");
  };
  xhr.onerror = xhr.ontimeout = function () { done("Couldn't reach the movie database. Is the TV online?"); };
  xhr.send();
}

function tmdb(path, params, done) {
  var query = "api_key=" + encodeURIComponent(movieKeys().tmdb) + "&language=en-US";
  for (var name in params) query += "&" + name + "=" + encodeURIComponent(params[name]);
  getJson(TMDB + path + (path.indexOf("?") < 0 ? "?" : "&") + query, done);
}

// TMDB's numbers for our services in Denmark. Looked up by name once a week,
// because services get renamed (HBO Max → Max → HBO Max).
function findServices(done) {
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(MOVIE_PROVIDERS_STORE)); } catch (e) {}
  if (cached && Date.now() - cached.at < 7 * 24 * 3600 * 1000) { done(null, cached.ids); return; }
  tmdb("/watch/providers/movie", { watch_region: REGION }, function (err, data) {
    if (err) { done(err); return; }
    var ids = {};
    SERVICES.forEach(function (s) {
      ids[s.name] = (data.results || []).filter(function (p) { return s.match.test(p.provider_name); })
        .map(function (p) { return p.provider_id; });
    });
    try { localStorage.setItem(MOVIE_PROVIDERS_STORE, JSON.stringify({ at: Date.now(), ids: ids })); } catch (e) {}
    done(null, ids);
  });
}

// Titles shown recently, so "New ideas" doesn't repeat itself.
function seenTitles() {
  try { return JSON.parse(localStorage.getItem(MOVIE_SEEN_STORE)) || []; } catch (e) { return []; }
}

function rememberSeen(list) {
  var seen = seenTitles().concat(list.map(function (t) { return t.kind + t.id; }));
  try { localStorage.setItem(MOVIE_SEEN_STORE, JSON.stringify(seen.slice(-150))); } catch (e) {}
}

function shuffle(list) {
  for (var i = list.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = list[i]; list[i] = list[j]; list[j] = t;
  }
  return list;
}

// Ask TMDB for the best-rated titles on the chosen services, take a random
// page from roughly the top 300, and pick a handful we haven't shown lately.
function findIdeas(done) {
  var kind = movies.kind;
  var mood = MOODS[movies.mood];
  findServices(function (err, ids) {
    if (err) { done(err); return; }
    var providers = [];
    SERVICES.forEach(function (s) { if (movies.services[s.name]) providers = providers.concat(ids[s.name] || []); });
    if (!providers.length) { done("TMDB doesn't list any of your services in Denmark right now."); return; }
    var params = {
      watch_region: REGION,
      with_watch_providers: providers.join("|"),
      with_watch_monetization_types: "flatrate",
      sort_by: "vote_average.desc",
      "vote_count.gte": kind === "movie" ? 400 : 150,
      include_adult: "false"
    };
    if (mood[kind]) params.with_genres = mood[kind];

    tmdb("/discover/" + kind, params, function (err, first) {
      if (err) { done(err); return; }
      var pages = Math.min(first.total_pages || 1, 15);
      var page = 1 + Math.floor(Math.random() * pages);
      if (page === 1) { choose(first.results, pages); return; }
      params.page = page;
      tmdb("/discover/" + kind, params, function (err, more) {
        choose(err ? first.results : more.results.concat(first.results), pages);
      });
    });

    function choose(results, pages) {
      var seen = seenTitles();
      var fresh = results.filter(function (r) { return r.poster_path && seen.indexOf(kind + r.id) < 0; });
      if (fresh.length < PICKS) fresh = results.filter(function (r) { return r.poster_path; });
      var picks = shuffle(fresh).slice(0, PICKS).map(function (r) {
        return {
          id: r.id, kind: kind,
          title: r.title || r.name,
          year: (r.release_date || r.first_air_date || "").slice(0, 4),
          overview: r.overview,
          poster: POSTER + r.poster_path,
          tmdbScore: r.vote_average
        };
      });
      if (!picks.length) { done("No ideas for that mood on your services. Try another mood."); return; }
      rememberSeen(picks);
      done(null, picks);
    }
  });
}

// Fill in the details for one title: where it streams, its runtime or
// seasons, and (with an OMDb key) its Rotten Tomatoes and IMDb scores.
function addDetails(title, done) {
  tmdb("/" + title.kind + "/" + title.id, { append_to_response: "watch/providers,external_ids" }, function (err, d) {
    if (err) { done(); return; }
    var here = (d["watch/providers"] && d["watch/providers"].results[REGION]) || {};
    title.services = SERVICES.filter(function (s) {
      return (here.flatrate || []).some(function (p) { return s.match.test(p.provider_name); });
    });
    title.genres = (d.genres || []).slice(0, 3).map(function (g) { return g.name; }).join(", ");
    if (d.runtime) title.length = Math.floor(d.runtime / 60) + "h " + (d.runtime % 60) + "m";
    if (d.number_of_seasons) title.length = d.number_of_seasons + (d.number_of_seasons === 1 ? " season" : " seasons");
    var imdbId = d.imdb_id || (d.external_ids && d.external_ids.imdb_id);
    var omdbKey = movieKeys().omdb;
    if (!imdbId || !omdbKey) { done(); return; }
    getJson("https://www.omdbapi.com/?apikey=" + encodeURIComponent(omdbKey) + "&i=" + imdbId, function (err, o) {
      if (!err && o.Response !== "False") {
        (o.Ratings || []).forEach(function (r) { if (r.Source === "Rotten Tomatoes") title.tomatoes = r.Value; });
        if (o.imdbRating && o.imdbRating !== "N/A") title.imdb = o.imdbRating;
      }
      done();
    });
  });
}

// ---------- The screen ----------

function openMoviePicker() {
  movies = { kind: "movie", mood: 0, services: {}, ideas: [], rows: [], row: 0, col: [0, 0, 0], loading: false, focusCards: true };
  SERVICES.forEach(function (s) { movies.services[s.name] = true; });

  var el = document.getElementById("movies");
  if (!el) {
    el = document.createElement("div");
    el.id = "movies";
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div class="movies-top"><h2>What do we watch?</h2>' +
    '<p class="movies-sub">Top-rated picks streaming in Denmark on your services</p></div>' +
    '<div class="movies-row" id="movies-controls"></div>' +
    '<div class="movies-row" id="movies-moods"></div>' +
    '<div id="movies-cards"></div>' +
    '<div id="movies-details"></div>' +
    '<p class="movies-credit">Film data from TMDB and JustWatch. Scores from OMDb. This app uses the TMDB API but is not endorsed or certified by TMDB.</p>';
  el.classList.add("open");

  openScreen({ onKey: movieKey, close: closeMoviePicker });
  buildMovieControls();
  if (movieKeys().tmdb) loadIdeas();
  else openMovieKeys();
}

function closeMoviePicker() {
  movies = null;
  document.getElementById("movies").classList.remove("open");
}

// A pill-shaped button. `on` shows it as selected.
function movieChip(label, on, onSelect, extraClass) {
  var chip = document.createElement("div");
  chip.className = "chip" + (on ? " on" : "") + (extraClass ? " " + extraClass : "");
  chip.innerHTML = label;
  chip.onSelect = onSelect;
  chip.addEventListener("click", onSelect);
  return chip;
}

function buildMovieControls() {
  var controls = document.getElementById("movies-controls");
  var moods = document.getElementById("movies-moods");
  controls.innerHTML = "";
  moods.innerHTML = "";

  controls.appendChild(movieChip(DICE + "<span>New ideas</span>", false, loadIdeas, "dice"));
  [["movie", "Films"], ["tv", "Series"]].forEach(function (k) {
    controls.appendChild(movieChip(k[1], movies.kind === k[0], function () {
      if (movies.kind === k[0]) return;
      movies.kind = k[0];
      if (!MOODS[movies.mood][k[0]]) movies.mood = 0;
      buildMovieControls();
      loadIdeas();
    }));
  });
  SERVICES.forEach(function (s) {
    controls.appendChild(movieChip(s.name, movies.services[s.name], function () {
      movies.services[s.name] = !movies.services[s.name];
      var any = SERVICES.some(function (x) { return movies.services[x.name]; });
      if (!any) movies.services[s.name] = true; // keep at least one
      buildMovieControls();
      loadIdeas();
    }, "service"));
  });
  controls.appendChild(movieChip("Movie keys", false, openMovieKeys, "keys"));

  MOODS.forEach(function (m, i) {
    if (i > 0 && !m[movies.kind]) return;
    moods.appendChild(movieChip(m.name, movies.mood === i, function () {
      movies.mood = i;
      buildMovieControls();
      loadIdeas();
    }));
  });

  collectMovieRows();
}

function collectMovieRows() {
  movies.rows = [
    [].slice.call(document.querySelectorAll("#movies-controls .chip")),
    [].slice.call(document.querySelectorAll("#movies-moods .chip")),
    [].slice.call(document.querySelectorAll("#movies-cards .card"))
  ];
  movies.rows.forEach(function (row, r) {
    row.forEach(function (el, c) {
      el.onmouseenter = function () { setMovieFocus(r, c); };
    });
  });
  if (!movies.rows[movies.row].length) movies.row = 0; // e.g. no cards after an error
  setMovieFocus(movies.row, movies.col[movies.row]);
}

function setMovieFocus(row, col) {
  if (!movies.rows[row] || !movies.rows[row].length) return;
  var old = document.querySelector("#movies .focused");
  if (old) old.classList.remove("focused");
  col = Math.max(0, Math.min(movies.rows[row].length - 1, col));
  movies.row = row;
  movies.col[row] = col;
  movies.rows[row][col].classList.add("focused");
  if (row === 2) showMovieDetails(movies.ideas[col]);
}

function loadIdeas() {
  if (movies.loading) return;
  movies.loading = true;
  document.getElementById("movies-cards").innerHTML = '<p class="movies-note">Finding ideas…</p>';
  document.getElementById("movies-details").innerHTML = "";
  findIdeas(function (err, ideas) {
    if (!movies) return;
    movies.loading = false;
    if (err) {
      document.getElementById("movies-cards").innerHTML = '<p class="movies-note"></p>';
      document.querySelector("#movies-cards .movies-note").textContent = err;
      movies.ideas = [];
      collectMovieRows();
      return;
    }
    movies.ideas = ideas;
    showMovieCards();
    ideas.forEach(function (idea) {
      addDetails(idea, function () {
        if (!movies || movies.ideas !== ideas) return;
        showMovieCards();
      });
    });
  });
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function scoreBadges(idea) {
  var html = "";
  if (idea.tomatoes) html += '<span class="score">' + TOMATO + idea.tomatoes + "</span>";
  if (idea.imdb) html += '<span class="score imdb"><b>IMDb</b>' + idea.imdb + "</span>";
  if (!idea.tomatoes && !idea.imdb && idea.tmdbScore) {
    html += '<span class="score">' + STAR + idea.tmdbScore.toFixed(1) + "</span>";
  }
  return html;
}

function showMovieCards() {
  var container = document.getElementById("movies-cards");
  container.innerHTML = "";
  movies.ideas.forEach(function (idea, i) {
    var card = document.createElement("div");
    card.className = "card";
    var service = idea.services && idea.services[0];
    card.innerHTML =
      '<div class="poster"><img src="' + idea.poster + '" alt="">' +
      (service ? '<span class="on-service" style="background:' + service.background + '"><img src="' + service.logo + '" alt="' + service.name + '"></span>' : "") +
      '<div class="scores">' + scoreBadges(idea) + "</div></div>" +
      '<div class="card-title">' + escapeHtml(idea.title) + "</div>";
    card.onSelect = function () { watchIdea(i); };
    card.addEventListener("click", card.onSelect);
    container.appendChild(card);
  });
  collectMovieRows();
  if (movies.focusCards && movies.ideas.length) { // the first time, jump to the ideas
    movies.focusCards = false;
    setMovieFocus(2, 0);
  }
}

function showMovieDetails(idea) {
  var el = document.getElementById("movies-details");
  if (!idea) { el.innerHTML = ""; return; }
  var facts = [idea.year, idea.genres, idea.length].filter(Boolean).join(" · ");
  var where = idea.services && idea.services.length ?
    "Press OK to open " + idea.services.map(function (s) { return s.name; }).join(" or ") + " and search for it." :
    (idea.services ? "Not on your services in Denmark right now." : "Checking where it streams…");
  el.innerHTML =
    "<h3>" + escapeHtml(idea.title) + "</h3>" +
    '<p class="facts">' + escapeHtml(facts) + ' <span class="detail-scores">' + scoreBadges(idea) + "</span></p>" +
    '<p class="overview">' + escapeHtml(idea.overview) + "</p>" +
    '<p class="where">' + escapeHtml(where) + "</p>";
}

// Open the streaming app that has it. Opening straight to the film isn't
// possible without each service's own IDs, so the title is shown as a reminder.
function watchIdea(i) {
  var idea = movies.ideas[i];
  var service = idea && idea.services && idea.services[0];
  if (!service) return;
  var index = -1;
  apps.forEach(function (a, n) { if (a.name === service.app) index = n; });
  closeScreen();
  if (index >= 0) launch(index);
  else showStatus("Add " + service.name + " with the + tile first.");
  if (index >= 0) setTimeout(function () { showStatus("Search for “" + idea.title + "”"); }, 1500);
}

function movieKey(k) {
  if (!movies) return false;
  if (movies.keysOpen) return movieKeysKey(k);
  if (k === KEY.LEFT) setMovieFocus(movies.row, movies.col[movies.row] - 1);
  else if (k === KEY.RIGHT) setMovieFocus(movies.row, movies.col[movies.row] + 1);
  else if (k === KEY.UP) moveMovieRow(-1);
  else if (k === KEY.DOWN) moveMovieRow(1);
  else if (k === KEY.OK) {
    var el = movies.rows[movies.row][movies.col[movies.row]];
    if (el) el.onSelect();
  } else return false;
  return true;
}

function moveMovieRow(step) {
  for (var r = movies.row + step; r >= 0 && r < movies.rows.length; r += step) {
    if (movies.rows[r].length) { setMovieFocus(r, movies.col[r]); return; }
  }
}

// ---------- The "Movie keys" screen ----------

// The TV's on-screen keyboard pops up when a box is selected. The ThinQ
// phone app can also type into it, which is much quicker.
function openMovieKeys() {
  var keys = movieKeys();
  var el = document.getElementById("movies-cards");
  document.getElementById("movies-details").innerHTML = "";
  el.innerHTML =
    '<div class="movie-keys">' +
    "<p>To find films, Goblin Mansion needs a free key from TMDB. A key from OMDb adds Rotten Tomatoes scores (optional).</p>" +
    '<label>TMDB key <span>(themoviedb.org → Settings → API)</span><input id="key-tmdb" type="text" spellcheck="false"></label>' +
    '<label>OMDb key <span>(omdbapi.com → API Key, free)</span><input id="key-omdb" type="text" spellcheck="false"></label>' +
    '<div class="key-buttons"></div></div>';
  var tmdbBox = document.getElementById("key-tmdb");
  var omdbBox = document.getElementById("key-omdb");
  tmdbBox.value = keys.tmdb;
  omdbBox.value = keys.omdb;
  var buttons = el.querySelector(".key-buttons");
  buttons.appendChild(movieChip("Save", false, function () {
    saveMovieKeys({ tmdb: tmdbBox.value.trim(), omdb: omdbBox.value.trim() });
    localStorage.removeItem(MOVIE_PROVIDERS_STORE);
    closeMovieKeys();
    loadIdeas();
  }));
  buttons.appendChild(movieChip("Cancel", false, function () {
    closeMovieKeys();
    if (movieKeys().tmdb) loadIdeas();
  }));

  // While typing in a box, keep the keys away from the launcher (except
  // Up/Down/Back, which leave the box).
  [tmdbBox, omdbBox].forEach(function (box) {
    box.addEventListener("keydown", function (e) {
      var k = e.keyCode;
      if (k === KEY.OK) { // "Done" on the on-screen keyboard
        e.stopPropagation();
        e.preventDefault();
        setKeysFocus(movies.keysOpen.focus + 1);
        return;
      }
      if (k !== KEY.UP && k !== KEY.DOWN && k !== KEY.BACK && k !== KEY.ESCAPE) e.stopPropagation();
    });
    box.addEventListener("click", function () { box.focus(); });
  });

  movies.keysOpen = { items: [tmdbBox, omdbBox].concat([].slice.call(buttons.children)), focus: 0 };
  movies.keysOpen.items.forEach(function (item, i) {
    item.addEventListener("mouseenter", function () { setKeysFocus(i); });
  });
  var old = document.querySelector("#movies .focused");
  if (old) old.classList.remove("focused");
  setKeysFocus(keys.tmdb ? 2 : 0);
}

function closeMovieKeys() {
  movies.keysOpen = null;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  document.getElementById("movies-cards").innerHTML = "";
  collectMovieRows();
}

function setKeysFocus(i) {
  var keys = movies.keysOpen;
  keys.focus = Math.max(0, Math.min(keys.items.length - 1, i));
  keys.items.forEach(function (item, n) { item.classList.toggle("focused", n === keys.focus); });
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function movieKeysKey(k) {
  var keys = movies.keysOpen;
  var item = keys.items[keys.focus];
  if (k === KEY.UP) setKeysFocus(Math.min(keys.focus, 2) - 1);
  else if (k === KEY.DOWN) setKeysFocus(keys.focus + 1);
  else if (k === KEY.LEFT && keys.focus === 3) setKeysFocus(2);
  else if (k === KEY.RIGHT && keys.focus === 2) setKeysFocus(3);
  else if (k === KEY.OK) {
    if (item.tagName === "INPUT") item.focus();
    else item.onSelect();
  } else if (k === KEY.BACK || k === KEY.ESCAPE) {
    if (document.activeElement === item) item.blur();
    else keys.items[3].onSelect(); // Back = Cancel
  } else return false;
  return true;
}
