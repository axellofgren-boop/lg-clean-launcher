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
var MOVIE_SCORES_STORE = "goblinMansion.movieScores";
var MOVIE_SAVED_STORE = "goblinMansion.movieSaved";
var TMDB = "https://api.themoviedb.org/3";
var POSTER = "https://image.tmdb.org/t/p/w342";
var REGION = "DK";
var PICKS = 5;
var LIST_SIZE = 40;

// What the cards show: 5 random ideas, or a top list sorted by a score.
var VIEWS = [
  { name: "random", label: "Surprise me" },
  { name: "tomatoes", label: "Top" },  // the tomato picture goes in front
  { name: "imdb", label: "Top" },      // and the IMDb badge
  { name: "saved", label: "" }         // a heart and how many you've saved
];

// "Only good ones": the lowest score to show. Rotten Tomatoes counts in
// percent, IMDb and TMDB out of 10.
var MIN_SCORES = [
  { label: "Any score", tenths: 0,  percent: 0 },
  { label: "7+",        tenths: 7,  percent: 75, percentLabel: "75%+" },
  { label: "7.5+",      tenths: 7.5, percent: 85, percentLabel: "85%+" },
  { label: "8+",        tenths: 8,  percent: 92, percentLabel: "92%+" }
];

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
var HEART = '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M16 28S3 20 3 11a7 7 0 0 1 13-3.5A7 7 0 0 1 29 11c0 9-13 17-13 17z" fill="#ff4f9a"/></svg>';
var IMDB = '<b class="imdb-badge">IMDb</b>';
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
    var min = MIN_SCORES[movies.minScore].tenths;
    if (min) params["vote_average.gte"] = min;

    tmdb("/discover/" + kind, params, function (err, first) {
      if (err) { done(err); return; }
      var pages = Math.min(first.total_pages || 1, 15);
      var page = 1 + Math.floor(Math.random() * pages);
      if (page === 1) { choose(first.results); return; }
      params.page = page;
      tmdb("/discover/" + kind, params, function (err, more) {
        choose(err ? first.results : more.results.concat(first.results));
      });
    });

    function choose(results) {
      var seen = seenTitles();
      var fresh = results.filter(function (r) { return r.poster_path && seen.indexOf(kind + r.id) < 0; });
      if (fresh.length < PICKS) fresh = results.filter(function (r) { return r.poster_path; });
      var picks = shuffle(fresh).slice(0, PICKS).map(function (r) { return titleFrom(r, kind); });
      if (!picks.length) { done("No ideas for that mood and score on your services. Try another one."); return; }
      rememberSeen(picks);
      done(null, picks);
    }
  });
}

function titleFrom(r, kind) {
  return {
    id: r.id, kind: kind,
    title: r.title || r.name,
    year: (r.release_date || r.first_air_date || "").slice(0, 4),
    overview: r.overview,
    poster: POSTER + r.poster_path,
    tmdbScore: r.vote_average
  };
}

// The top list: the best-rated titles from TMDB (two pages, about 40), each
// looked up on OMDb, then sorted by Rotten Tomatoes or IMDb. `progress` is
// called as the lookups come in.
function findTopList(progress, done) {
  var kind = movies.kind;
  var view = VIEWS[movies.view].name;
  if (!movieKeys().omdb) { done("Sorting by Rotten Tomatoes or IMDb needs an OMDb key. Add one on Movie keys."); return; }
  findServices(function (err, ids) {
    if (err) { done(err); return; }
    var providers = [];
    SERVICES.forEach(function (s) { if (movies.services[s.name]) providers = providers.concat(ids[s.name] || []); });
    if (!providers.length) { done("TMDB doesn't list any of your services in Denmark right now."); return; }
    var mood = MOODS[movies.mood];
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
      if ((first.total_pages || 1) < 2) { lookUp(first.results); return; }
      params.page = 2;
      tmdb("/discover/" + kind, params, function (err, second) {
        lookUp(first.results.concat(err ? [] : second.results));
      });
    });
  });

  function lookUp(results) {
    var list = results.filter(function (r) { return r.poster_path; }).slice(0, LIST_SIZE)
      .map(function (r) { return titleFrom(r, kind); });
    if (!list.length) { done("Nothing for that mood on your services. Try another mood."); return; }
    var finished = 0;
    inBatches(list, 6, addDetails, function () {
      finished++;
      progress(finished, list.length);
    }, function () {
      var min = MIN_SCORES[movies.minScore];
      var scored = list.filter(function (t) {
        var score = scoreFor(t, view);
        if (score === null) return !min.tenths; // no score: only shown with "Any score"
        return score >= (view === "tomatoes" ? min.percent : min.tenths);
      });
      scored.sort(function (a, b) {
        var x = scoreFor(a, view), y = scoreFor(b, view);
        if (x === null) return y === null ? 0 : 1;
        if (y === null) return -1;
        return y - x;
      });
      if (!scored.length) { done("None of these reach that score. Try a lower one."); return; }
      done(null, scored);
    });
  }
}

function scoreFor(title, view) {
  if (view === "tomatoes") return title.tomatoes ? parseInt(title.tomatoes, 10) : null;
  return title.imdb ? parseFloat(title.imdb) : null;
}

// Run `work` on every item, a few at a time, so the TV isn't asked to do 40
// downloads at once.
function inBatches(items, size, work, each, done) {
  var next = 0, running = 0, left = items.length;
  function start() {
    while (running < size && next < items.length) {
      running++;
      work(items[next++], function () {
        running--;
        left--;
        each();
        if (left === 0) done();
        else start();
      });
    }
  }
  start();
}

// Rotten Tomatoes and IMDb scores barely change, so they're remembered on
// the TV for a month. That keeps well under OMDb's 1,000 free lookups a day.
function savedScores() {
  try { return JSON.parse(localStorage.getItem(MOVIE_SCORES_STORE)) || {}; } catch (e) { return {}; }
}

function saveScore(imdbId, tomatoes, imdb) {
  var all = savedScores();
  all[imdbId] = { t: tomatoes || "", i: imdb || "", at: Date.now() };
  var ids = Object.keys(all);
  if (ids.length > 1500) { // keep the newest ones
    ids.sort(function (a, b) { return all[a].at - all[b].at; });
    ids.slice(0, ids.length - 1500).forEach(function (id) { delete all[id]; });
  }
  try { localStorage.setItem(MOVIE_SCORES_STORE, JSON.stringify(all)); } catch (e) {}
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
    title.imdbId = imdbId;
    var omdbKey = movieKeys().omdb;
    if (!imdbId || !omdbKey) { done(); return; }
    var saved = savedScores()[imdbId];
    if (saved && Date.now() - saved.at < 30 * 24 * 3600 * 1000) {
      title.tomatoes = saved.t;
      title.imdb = saved.i;
      done();
      return;
    }
    getJson("https://www.omdbapi.com/?apikey=" + encodeURIComponent(omdbKey) + "&i=" + imdbId, function (err, o) {
      if (!err && o.Response !== "False") {
        (o.Ratings || []).forEach(function (r) { if (r.Source === "Rotten Tomatoes") title.tomatoes = r.Value; });
        if (o.imdbRating && o.imdbRating !== "N/A") title.imdb = o.imdbRating;
        saveScore(imdbId, title.tomatoes, title.imdb);
      }
      done();
    });
  });
}

// ---------- Saved for later ----------

// Saved titles are kept on the TV with everything needed to show them again.
// Services are stored by name and looked up again in SERVICES.
function savedList() {
  var list = [];
  try { list = JSON.parse(localStorage.getItem(MOVIE_SAVED_STORE)) || []; } catch (e) {}
  return list.map(function (t) {
    t.services = (t.serviceNames || []).map(function (name) {
      return SERVICES.filter(function (s) { return s.name === name; })[0];
    }).filter(Boolean);
    return t;
  });
}

function isSaved(title) {
  return savedList().some(function (t) { return t.kind === title.kind && t.id === title.id; });
}

function toggleSaved(title) {
  var list = savedList().filter(function (t) { return !(t.kind === title.kind && t.id === title.id); });
  var saving = list.length === savedList().length;
  if (saving) list.unshift(title); // newest first
  var plain = list.map(function (t) {
    return {
      id: t.id, kind: t.kind, title: t.title, year: t.year, overview: t.overview, poster: t.poster,
      imdbId: t.imdbId, tmdbScore: t.tmdbScore, tomatoes: t.tomatoes, imdb: t.imdb, genres: t.genres, length: t.length,
      serviceNames: (t.services || []).map(function (s) { return s.name; })
    };
  });
  try { localStorage.setItem(MOVIE_SAVED_STORE, JSON.stringify(plain)); } catch (e) {}
  return saving;
}

// ---------- The screen ----------
//
// Three rows you move between with Up and Down:
//   0. the switch at the top right: Surprise me, 🍅 Top, IMDb Top, ♥ Saved
//   1. the filter buttons: Films ▾, Mood ▾, On ▾, Score ▾, and ⚙ for the keys
//   2. the posters
// A filter button opens a small menu; OK on a poster opens a pop-up with the
// description and the Open and Save buttons.

var TABS = 0, FILTERS = 1, CARDS = 2;

function openMoviePicker() {
  movies = { kind: "movie", mood: 0, view: 0, minScore: 0, services: {}, ideas: [], rows: [], row: TABS,
    col: [0, 0, 0], focusCards: true, menu: null, sheet: null };
  SERVICES.forEach(function (s) { movies.services[s.name] = true; });

  var el = document.getElementById("movies");
  if (!el) {
    el = document.createElement("div");
    el.id = "movies";
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div class="movies-top"><h2>What do we watch?</h2><div class="movies-tabs" id="movies-tabs"></div></div>' +
    '<div class="movies-filters" id="movies-filters"></div>' +
    '<div id="movies-cards"></div>' +
    '<div id="movies-info"></div>' +
    '<p class="movies-credit">Film data from TMDB and JustWatch. Scores from OMDb. This app uses the TMDB API but is not endorsed or certified by TMDB.</p>';
  el.className = "open";

  openScreen({ onKey: movieKey, close: closeMoviePicker });
  buildMovieControls();
  if (movieKeys().tmdb) loadIdeas();
  else openMovieKeys();
}

function closeMoviePicker() {
  movies = null;
  document.getElementById("movies").className = "";
}

// A button. `on` shows it as selected.
function movieChip(label, on, onSelect, extraClass) {
  var chip = document.createElement("div");
  chip.className = "chip" + (on ? " on" : "") + (extraClass ? " " + extraClass : "");
  chip.innerHTML = label;
  chip.onSelect = onSelect;
  chip.addEventListener("click", function (e) { e.stopPropagation(); onSelect(); });
  return chip;
}

function serviceLogos() {
  var on = SERVICES.filter(function (s) { return movies.services[s.name]; });
  return on.map(function (s) { return '<img src="' + s.logo + '" alt="' + s.name + '">'; }).join("");
}

function scoreLabel() {
  var m = MIN_SCORES[movies.minScore];
  return (VIEWS[movies.view].name === "tomatoes" && m.percentLabel) || (movies.minScore ? m.label : "Any");
}

function buildMovieControls() {
  var tabs = document.getElementById("movies-tabs");
  var filters = document.getElementById("movies-filters");
  tabs.innerHTML = "";
  filters.innerHTML = "";

  // The switch at the top. Pressing Surprise me again shuffles.
  var pictures = [DICE, TOMATO, IMDB, HEART];
  VIEWS.forEach(function (v, i) {
    var label = v.name === "saved" ? String(savedList().length) : v.label;
    tabs.appendChild(movieChip(pictures[i] + "<span>" + label + "</span>", movies.view === i, function () {
      var changed = movies.view !== i;
      movies.view = i;
      if (changed) buildMovieControls();
      if (changed || v.name === "random") loadIdeas();
    }, "tab"));
  });

  var caret = ' <span class="caret">▼</span>';
  filters.appendChild(movieChip((movies.kind === "movie" ? "Films" : "Series") + caret, false, function () {
    openMovieMenu(0, [["movie", "Films"], ["tv", "Series"]].map(function (k) {
      return { label: k[1], on: movies.kind === k[0], pick: function () {
        movies.kind = k[0];
        if (!MOODS[movies.mood][k[0]]) movies.mood = 0;
      } };
    }), 1);
  }, "pill"));
  filters.appendChild(movieChip("<small>Mood</small> " + MOODS[movies.mood].name + caret, false, function () {
    var options = [];
    MOODS.forEach(function (m, i) {
      if (i > 0 && !m[movies.kind]) return;
      options.push({ label: m.name, on: movies.mood === i, pick: function () { movies.mood = i; } });
    });
    openMovieMenu(1, options, 2);
  }, "pill"));
  filters.appendChild(movieChip("<small>On</small> " + serviceLogos() + caret, false, function () {
    openMovieMenu(2, SERVICES.map(function (s) {
      return {
        label: '<span class="menu-logo" style="background:' + s.background + '"><img src="' + s.logo + '" alt=""></span>' + s.name,
        on: movies.services[s.name],
        pick: function () {
          movies.services[s.name] = !movies.services[s.name];
          var any = SERVICES.some(function (x) { return movies.services[x.name]; });
          if (!any) movies.services[s.name] = true; // keep at least one
        }
      };
    }), 1, true);
  }, "pill services"));
  if (VIEWS[movies.view].name !== "saved") {
    filters.appendChild(movieChip("<small>Score</small> " + scoreLabel() + caret, false, function () {
      var percent = VIEWS[movies.view].name === "tomatoes";
      openMovieMenu(3, MIN_SCORES.map(function (m, i) {
        return { label: (percent && m.percentLabel) || m.label, on: movies.minScore === i, pick: function () { movies.minScore = i; } };
      }), 1);
    }, "pill"));
  }
  filters.appendChild(movieChip("⚙", false, openMovieKeys, "pill gear"));

  refreshRows();
}

function refreshRows() {
  movies.rows = [
    [].slice.call(document.querySelectorAll("#movies-tabs .chip")),
    [].slice.call(document.querySelectorAll("#movies-filters .chip")),
    [].slice.call(document.querySelectorAll("#movies-cards .card"))
  ];
  movies.rows.forEach(function (row, r) {
    row.forEach(function (el, c) {
      el.onmouseenter = function () { if (!movies.menu && !movies.sheet) setMovieFocus(r, c); };
    });
  });
  if (!movies.rows[movies.row].length) movies.row = movies.rows[CARDS].length ? CARDS : TABS;
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
  if (row === CARDS) {
    showMovieInfo(movies.ideas[col]);
    // Keep the chosen poster in view while moving along a long list.
    var cards = document.getElementById("movies-cards");
    var card = movies.rows[row][col];
    cards.scrollLeft = Math.max(0, card.offsetLeft - cards.offsetLeft - (cards.clientWidth - card.offsetWidth) / 2);
  }
}

// ---------- Filter menus ----------

// A small menu under filter button number `index`. Picking an option in a
// one-choice menu closes it; in a `multi` menu (the services) OK ticks options
// on and off, and Back closes it. Ideas are fetched again if anything changed.
function openMovieMenu(index, options, columns, multi) {
  var button = movies.rows[FILTERS][index];
  var menu = document.createElement("div");
  menu.className = "movie-menu";
  menu.style.gridTemplateColumns = "repeat(" + columns + ", auto)";
  menu.style.left = (button.offsetLeft - document.getElementById("movies-filters").offsetLeft) + "px";
  options.forEach(function (o, i) {
    var item = document.createElement("div");
    item.className = "opt" + (o.on ? " on" : "");
    item.innerHTML = o.label;
    item.addEventListener("click", function (e) { e.stopPropagation(); pickMenuOption(i); });
    item.addEventListener("mouseenter", function () { setMenuFocus(i); });
    menu.appendChild(item);
  });
  document.getElementById("movies-filters").appendChild(menu);
  document.getElementById("movies").classList.add("dim");
  var first = 0;
  if (!multi) options.forEach(function (o, i) { if (o.on) first = i; });
  movies.menu = { el: menu, options: options, columns: columns, multi: multi, focus: first, changed: false };
  setMenuFocus(first);
}

function setMenuFocus(i) {
  var menu = movies.menu;
  var items = menu.el.children;
  menu.focus = Math.max(0, Math.min(items.length - 1, i));
  for (var n = 0; n < items.length; n++) items[n].classList.toggle("focused", n === menu.focus);
}

function pickMenuOption(i) {
  var menu = movies.menu;
  menu.options[i].pick();
  menu.changed = true;
  if (!menu.multi) { closeMovieMenu(); return; }
  SERVICES.forEach(function (s, n) { menu.el.children[n].classList.toggle("on", movies.services[s.name]); });
}

function closeMovieMenu() {
  var menu = movies.menu;
  movies.menu = null;
  menu.el.parentNode.removeChild(menu.el);
  document.getElementById("movies").classList.remove("dim");
  var col = movies.col[FILTERS];
  buildMovieControls();
  setMovieFocus(FILTERS, col);
  if (menu.changed) loadIdeas();
}

function movieMenuKey(k) {
  var menu = movies.menu;
  if (k === KEY.LEFT) setMenuFocus(menu.focus - 1);
  else if (k === KEY.RIGHT) setMenuFocus(menu.focus + 1);
  else if (k === KEY.UP) {
    if (menu.focus < menu.columns) closeMovieMenu();
    else setMenuFocus(menu.focus - menu.columns);
  } else if (k === KEY.DOWN) setMenuFocus(menu.focus + menu.columns);
  else if (k === KEY.OK) pickMenuOption(menu.focus);
  else if (k === KEY.BACK || k === KEY.ESCAPE) closeMovieMenu();
  else return false;
  return true;
}

// ---------- Finding ideas ----------

function loadIdeas() {
  var cards = document.getElementById("movies-cards");
  cards.classList.toggle("list", movies.view > 0);
  cards.innerHTML = '<p class="movies-note">Finding ideas…</p>';
  document.getElementById("movies-info").innerHTML = "";
  movies.col[CARDS] = 0;
  var request = movies.request = {};

  if (VIEWS[movies.view].name === "saved") {
    movies.ideas = savedList();
    if (!movies.ideas.length) {
      showMovieError("Nothing saved yet. Press OK on a poster, then pick Save.");
      return;
    }
    showMovieCards();
    // Check again where each one streams now (TMDB only; scores are kept).
    movies.ideas.forEach(function (idea) {
      tmdb("/" + idea.kind + "/" + idea.id, { append_to_response: "watch/providers" }, function (err, d) {
        if (err || !movies || movies.request !== request) return;
        var here = (d["watch/providers"] && d["watch/providers"].results[REGION]) || {};
        idea.services = SERVICES.filter(function (s) {
          return (here.flatrate || []).some(function (p) { return s.match.test(p.provider_name); });
        });
        showMovieCards();
      });
    });
    return;
  }

  if (movies.view > 0) {
    findTopList(function (n, total) {
      if (movies && movies.request === request) {
        cards.innerHTML = '<p class="movies-note">Looking up scores… ' + n + " of " + total + "</p>";
      }
    }, function (err, list) {
      if (!movies || movies.request !== request) return;
      if (err) { showMovieError(err); return; }
      movies.ideas = list;
      showMovieCards();
    });
    return;
  }

  findIdeas(function (err, ideas) {
    if (!movies || movies.request !== request) return;
    if (err) { showMovieError(err); return; }
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

function showMovieError(err) {
  document.getElementById("movies-cards").innerHTML = '<p class="movies-note"></p>';
  document.querySelector("#movies-cards .movies-note").textContent = err;
  document.getElementById("movies-info").innerHTML = "";
  movies.ideas = [];
  refreshRows();
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function scoreBadges(idea) {
  var html = "";
  if (idea.tomatoes) html += '<span class="score">' + TOMATO + idea.tomatoes + "</span>";
  if (idea.imdb) html += '<span class="score imdb">' + IMDB + idea.imdb + "</span>";
  if (!idea.tomatoes && !idea.imdb && idea.tmdbScore) {
    html += '<span class="score">' + STAR + idea.tmdbScore.toFixed(1) + "</span>";
  }
  return html;
}

// The poster shows one score: the one the list is sorted by, otherwise
// Rotten Tomatoes, otherwise IMDb, otherwise TMDB's stars.
function posterScore(idea) {
  var view = VIEWS[movies.view].name;
  if (view === "imdb" && idea.imdb) return '<span class="score imdb">' + IMDB + idea.imdb + "</span>";
  if (idea.tomatoes) return '<span class="score">' + TOMATO + idea.tomatoes + "</span>";
  if (idea.imdb) return '<span class="score imdb">' + IMDB + idea.imdb + "</span>";
  return idea.tmdbScore ? '<span class="score">' + STAR + idea.tmdbScore.toFixed(1) + "</span>" : "";
}

function showMovieCards() {
  var container = document.getElementById("movies-cards");
  container.innerHTML = "";
  var view = VIEWS[movies.view].name;
  movies.ideas.forEach(function (idea, i) {
    var card = document.createElement("div");
    card.className = "card";
    var service = idea.services && idea.services[0];
    var corner = view === "tomatoes" || view === "imdb" ? '<span class="rank">' + (i + 1) + "</span>" : "";
    if (isSaved(idea)) corner += '<span class="saved-heart">' + HEART + "</span>";
    card.innerHTML =
      '<div class="poster">' + corner + '<img src="' + idea.poster + '" alt="">' +
      (service ? '<span class="on-service" style="background:' + service.background + '"><img src="' + service.logo + '" alt="' + service.name + '"></span>' : "") +
      '<div class="scores">' + posterScore(idea) + "</div></div>";
    card.onSelect = function () { openMovieSheet(i); };
    card.addEventListener("click", card.onSelect);
    container.appendChild(card);
  });
  refreshRows();
  if (movies.focusCards && movies.ideas.length) { // the first time, jump to the ideas
    movies.focusCards = false;
    setMovieFocus(CARDS, 0);
  }
}

function factsLine(idea) {
  var facts = [idea.year, idea.genres, idea.length].filter(Boolean).join(" · ");
  return escapeHtml(facts) + ' <span class="detail-scores">' + scoreBadges(idea) + "</span>";
}

// One line under the posters about the chosen one.
function showMovieInfo(idea) {
  var el = document.getElementById("movies-info");
  if (!idea) { el.innerHTML = ""; return; }
  el.innerHTML = "<h3>" + escapeHtml(idea.title) + "</h3>" +
    '<p class="facts">' + factsLine(idea) + "</p>" +
    '<p class="hint"><span class="key">OK</span>Watch, save or read more</p>';
}

// ---------- The pop-up for one title ----------

function openMovieSheet(i) {
  var idea = movies.ideas[i];
  var sheet = document.createElement("div");
  sheet.className = "movie-sheet";
  var where = idea.services && idea.services.length ? "" :
    (idea.services ? "Not on your services in Denmark right now." : "Checking where it streams…");
  sheet.innerHTML =
    '<div class="poster"><img src="' + idea.poster + '" alt=""></div><div class="sheet-text">' +
    "<h3>" + escapeHtml(idea.title) + "</h3>" +
    '<p class="facts">' + factsLine(idea) + "</p>" +
    '<p class="overview">' + escapeHtml(idea.overview) + "</p>" +
    (where ? '<p class="where">' + escapeHtml(where) + "</p>" : "") +
    '<div class="sheet-buttons"></div></div>';
  var buttons = sheet.querySelector(".sheet-buttons");
  if (idea.services && idea.services.length) {
    buttons.appendChild(movieChip("▶ Open " + idea.services[0].name, false, function () { watchIdea(i); }, "primary"));
  }
  var saved = isSaved(idea);
  buttons.appendChild(movieChip(HEART + "<span>" + (saved ? "Saved · remove" : "Save") + "</span>", false, function () {
    toggleSaved(idea);
    var gone = VIEWS[movies.view].name === "saved";
    closeMovieSheet();
    buildMovieControls(); // updates the ♥ count
    if (gone) loadIdeas();
    else { showMovieCards(); setMovieFocus(CARDS, i); }
  }));
  buttons.appendChild(movieChip("Back", false, closeMovieSheet));
  document.getElementById("movies").appendChild(sheet);
  document.getElementById("movies").classList.add("dim");

  var items = [].slice.call(buttons.children);
  items.forEach(function (b, n) { b.addEventListener("mouseenter", function () { setSheetFocus(n); }); });
  movies.sheet = { el: sheet, items: items, focus: 0 };
  setSheetFocus(0);
}

function setSheetFocus(n) {
  var sheet = movies.sheet;
  sheet.focus = Math.max(0, Math.min(sheet.items.length - 1, n));
  sheet.items.forEach(function (b, i) { b.classList.toggle("focused", i === sheet.focus); });
}

function closeMovieSheet() {
  if (!movies.sheet) return;
  movies.sheet.el.parentNode.removeChild(movies.sheet.el);
  movies.sheet = null;
  document.getElementById("movies").classList.remove("dim");
}

function movieSheetKey(k) {
  var sheet = movies.sheet;
  if (k === KEY.LEFT || k === KEY.UP) setSheetFocus(sheet.focus - 1);
  else if (k === KEY.RIGHT || k === KEY.DOWN) setSheetFocus(sheet.focus + 1);
  else if (k === KEY.OK) sheet.items[sheet.focus].onSelect();
  else if (k === KEY.BACK || k === KEY.ESCAPE) closeMovieSheet();
  else return false;
  return true;
}

// ---------- Opening it ----------

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

// ---------- The remote ----------

function movieKey(k) {
  if (!movies) return false;
  if (movies.keysOpen) return movieKeysKey(k);
  if (movies.menu) return movieMenuKey(k);
  if (movies.sheet) return movieSheetKey(k);
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
  el.classList.remove("list");
  el.classList.add("keys-open");
  document.getElementById("movies-info").innerHTML = "";
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
  document.getElementById("movies-cards").classList.remove("keys-open");
  refreshRows();
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
