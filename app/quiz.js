// The Couch Quiz: a trivia game for two, played with one remote.
// Questions come from the Open Trivia Database (opentdb.com, free, no key).
// If the TV can't reach it, the game uses the backup questions in
// quiz-questions.js instead.

var QUIZ_TOPICS = [
  // name shown on screen, Open Trivia DB category number, backup topic
  { name: "Mixed",       otdb: null, backup: null },
  { name: "Movies",      otdb: 11,   backup: "Movies" },
  { name: "TV",          otdb: 14,   backup: "TV" },
  { name: "Music",       otdb: 12,   backup: "Music" },
  { name: "Science",     otdb: 17,   backup: "Science" },
  { name: "Geography",   otdb: 22,   backup: "Geography" },
  { name: "History",     otdb: 23,   backup: "History" },
  { name: "Video games", otdb: 15,   backup: null }
];
var QUIZ_LEVELS = ["Any", "Easy", "Medium", "Hard"];
var QUIZ_LENGTHS = [10, 16, 20];
var QUIZ_TIMERS = ["Off", "20 s", "10 s"];
var QUIZ_PLAYERS = [
  { name: "Pink Goblin",   color: "#ff8fd8" },
  { name: "Purple Goblin", color: "#b48cff" }
];

var QUIZ_SETTINGS_KEY = "goblinMansion.quizSettings";
var QUIZ_TOKEN_KEY = "goblinMansion.quizToken";

var quiz = null; // everything about the game in progress

// ---------- Opening and closing ----------

function openQuiz() {
  var el = document.getElementById("quiz");
  if (!el) {
    el = document.createElement("div");
    el.id = "quiz";
    document.body.appendChild(el);
  }
  el.classList.add("open");
  quiz = { el: el, settings: loadQuizSettings(), rows: [], row: 0, col: 0 };
  openScreen({ onKey: quizKey, close: closeQuiz });
  showQuizSetup();
}

function closeQuiz() {
  if (!quiz) return;
  clearInterval(quiz.timer);
  quiz.el.classList.remove("open");
  quiz.el.innerHTML = "";
  quiz = null;
}

function loadQuizSettings() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem(QUIZ_SETTINGS_KEY)); } catch (e) {}
  return s || { topic: 1, level: 0, length: 0, timer: 0 };
}

function saveQuizSettings() {
  try { localStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify(quiz.settings)); } catch (e) {}
}

// ---------- Buttons and the remote ----------

// Every quiz screen is a grid of buttons: quiz.rows is a list of rows, each a
// list of button elements. Up/Down moves between rows, Left/Right along a row.
function quizButton(label, onSelect, className) {
  var b = document.createElement("div");
  b.className = "quiz-btn" + (className ? " " + className : "");
  b.innerHTML = label;
  b.onSelect = onSelect;
  b.addEventListener("click", function () { quizSelect(b); });
  b.addEventListener("mouseenter", function () { quizFocusOn(b); }); // Magic Remote pointer
  return b;
}

// The Magic Remote can send both a click and an OK key for one press, so
// ignore a second select that comes straight after the first.
function quizSelect(b) {
  var now = Date.now();
  if (quiz.lastSelect && now - quiz.lastSelect < 400) return;
  quiz.lastSelect = now;
  b.onSelect();
}

function quizSetRows(rows, row, col) {
  var old = quizFocused();
  if (old) old.classList.remove("focused");
  quiz.rows = rows.filter(function (r) { return r.length; });
  quizFocus(row || 0, col || 0);
}

function quizFocus(row, col) {
  var current = quizFocused();
  if (current) current.classList.remove("focused");
  if (!quiz.rows.length) return;
  quiz.row = Math.max(0, Math.min(quiz.rows.length - 1, row));
  var r = quiz.rows[quiz.row];
  quiz.col = Math.max(0, Math.min(r.length - 1, col));
  r[quiz.col].classList.add("focused");
}

function quizFocused() {
  var r = quiz.rows[quiz.row];
  return r && r[quiz.col];
}

function quizFocusOn(b) {
  for (var i = 0; i < quiz.rows.length; i++) {
    var j = quiz.rows[i].indexOf(b);
    if (j >= 0) { quizFocus(i, j); return; }
  }
}

function quizKey(k) {
  if (k === KEY.BACK || k === KEY.ESCAPE) return quizBack();
  if (k === KEY.UP) quizFocus(quiz.row - 1, quiz.col);
  else if (k === KEY.DOWN) quizFocus(quiz.row + 1, quiz.col);
  else if (k === KEY.LEFT) quizFocus(quiz.row, quiz.col - 1);
  else if (k === KEY.RIGHT) quizFocus(quiz.row, quiz.col + 1);
  else if (k === KEY.OK && quizFocused()) quizSelect(quizFocused());
  return true;
}

// Back on the setup screen leaves the quiz. During a game, the first Back
// asks, and a second one within three seconds goes back to the setup screen.
function quizBack() {
  if (quiz.screen === "setup") return false;
  if (quiz.screen === "game") {
    var now = Date.now();
    if (!quiz.backAt || now - quiz.backAt > 3000) {
      quiz.backAt = now;
      quizNote("Press Back again to stop this game");
      return true;
    }
  }
  showQuizSetup();
  return true;
}

function quizNote(text) {
  var note = quiz.el.querySelector(".quiz-note");
  if (note) note.textContent = text;
}

// ---------- The setup screen ----------

function showQuizSetup() {
  clearInterval(quiz.timer);
  quiz.screen = "setup";
  quiz.backAt = 0;
  var s = quiz.settings;
  quiz.el.innerHTML =
    '<h2 class="quiz-title">Couch Quiz</h2>' +
    '<p class="quiz-sub">Two goblins, one remote. Take turns: the questions alternate between ' +
    '<b style="color:' + QUIZ_PLAYERS[0].color + '">' + QUIZ_PLAYERS[0].name + '</b> and ' +
    '<b style="color:' + QUIZ_PLAYERS[1].color + '">' + QUIZ_PLAYERS[1].name + '</b>.</p>' +
    '<div class="quiz-setup"></div><p class="quiz-note"></p>';
  var box = quiz.el.querySelector(".quiz-setup");

  function choiceRow(label, options, key) {
    var line = document.createElement("div");
    line.className = "quiz-line";
    line.innerHTML = '<span class="quiz-label">' + label + "</span>";
    var row = options.map(function (opt, i) {
      var b = quizButton(String(opt), function () {
        s[key] = i;
        row.forEach(function (o, j) { o.classList.toggle("chosen", j === i); });
      }, "chip" + (s[key] === i ? " chosen" : ""));
      line.appendChild(b);
      return b;
    });
    box.appendChild(line);
    return row;
  }

  var rows = [
    choiceRow("Topic", QUIZ_TOPICS.map(function (t) { return t.name; }), "topic"),
    choiceRow("Difficulty", QUIZ_LEVELS, "level"),
    choiceRow("Questions", QUIZ_LENGTHS, "length"),
    choiceRow("Timer", QUIZ_TIMERS, "timer")
  ];
  var start = quizButton("Start!", startQuiz, "big");
  var line = document.createElement("div");
  line.className = "quiz-line quiz-actions";
  line.appendChild(start);
  box.appendChild(line);
  rows.push([start]);
  quizSetRows(rows, rows.length - 1, 0);
}

// ---------- Getting questions ----------

function startQuiz() {
  saveQuizSettings();
  quiz.screen = "loading";
  quiz.el.innerHTML = '<h2 class="quiz-title">Couch Quiz</h2><p class="quiz-sub">Summoning questions…</p>';
  quizSetRows([]);
  var amount = QUIZ_LENGTHS[quiz.settings.length];
  fetchQuizQuestions(amount, function (questions, note) {
    if (!quiz || quiz.screen !== "loading") return; // Back was pressed while loading
    quiz.questions = questions;
    quiz.index = 0;
    quiz.scores = [0, 0];
    quiz.screen = "game";
    quiz.startNote = note || "";
    showQuizQuestion();
  });
}

function quizGet(url, done) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.timeout = 8000;
  xhr.onload = function () {
    var data = null;
    try { data = JSON.parse(xhr.responseText); } catch (e) {}
    done(data);
  };
  xhr.onerror = xhr.ontimeout = function () { done(null); };
  xhr.send();
}

// The database hands out a "session token" that remembers which questions
// you've already had, so you don't get repeats. It's kept on the TV.
function quizToken(done) {
  var saved = null;
  try { saved = localStorage.getItem(QUIZ_TOKEN_KEY); } catch (e) {}
  if (saved) { done(saved); return; }
  quizGet("https://opentdb.com/api_token.php?command=request", function (data) {
    var token = data && data.token;
    if (token) try { localStorage.setItem(QUIZ_TOKEN_KEY, token); } catch (e) {}
    done(token || "");
  });
}

function fetchQuizQuestions(amount, done) {
  var topic = QUIZ_TOPICS[quiz.settings.topic];
  var level = QUIZ_LEVELS[quiz.settings.level].toLowerCase();

  function ask(token, useLevel, tries) {
    var url = "https://opentdb.com/api.php?type=multiple&encode=url3986&amount=" + amount;
    if (topic.otdb) url += "&category=" + topic.otdb;
    if (useLevel && level !== "any") url += "&difficulty=" + level;
    if (token) url += "&token=" + token;
    quizGet(url, function (data) {
      var code = data ? data.response_code : -1;
      if (code === 0 && data.results.length) {
        done(data.results.map(fromOpenTrivia));
      } else if (code === 3 && tries < 2) {
        // The token expired (after 6 hours unused): get a fresh one.
        try { localStorage.removeItem(QUIZ_TOKEN_KEY); } catch (e) {}
        quizToken(function (t) { ask(t, useLevel, tries + 1); });
      } else if (code === 4 && tries < 2) {
        // You've seen every question in this topic: start the topic over.
        quizGet("https://opentdb.com/api_token.php?command=reset&token=" + token, function () {
          ask(token, useLevel, tries + 1);
        });
      } else if (code === 1 && useLevel) {
        // Not enough questions at that difficulty: try any difficulty.
        ask(token, false, tries);
      } else if (code === 5 && tries < 2) {
        // Asked too quickly (one request per 5 seconds): wait and try again.
        setTimeout(function () { ask(token, useLevel, tries + 1); }, 5500);
      } else {
        done(backupQuestions(topic, amount),
          "Couldn't reach the quiz library, so these are Goblin Mansion's own questions.");
      }
    });
  }
  quizToken(function (token) { ask(token, true, 0); });
}

function fromOpenTrivia(r) {
  var d = decodeURIComponent;
  return {
    topic: d(r.category).replace(/^Entertainment: /, ""),
    level: d(r.difficulty),
    question: d(r.question),
    answer: d(r.correct_answer),
    answers: shuffle([r.correct_answer].concat(r.incorrect_answers).map(d))
  };
}

function backupQuestions(topic, amount) {
  var all = QUIZ_BACKUP.map(function (q) {
    return { topic: q[0], question: q[1], answer: q[2], answers: shuffle([q[2]].concat(q[3])) };
  });
  var picked = shuffle(all.filter(function (q) { return !topic.backup || q.topic === topic.backup; }));
  // Too few in that topic? Top up with questions from the others.
  var others = shuffle(all.filter(function (q) { return picked.indexOf(q) < 0; }));
  return picked.concat(others).slice(0, amount);
}

function shuffle(list) {
  list = list.slice();
  for (var i = list.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = list[i]; list[i] = list[j]; list[j] = t;
  }
  return list;
}

// ---------- Playing ----------

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function quizScoreboard() {
  var turn = quiz.index % 2;
  return '<div class="quiz-scores">' + QUIZ_PLAYERS.map(function (p, i) {
    return '<div class="quiz-player' + (i === turn && quiz.screen === "game" ? " up" : "") +
      '" style="--player:' + p.color + '"><span>' + p.name + "</span><b>" + quiz.scores[i] + "</b></div>";
  }).join("") + "</div>";
}

function showQuizQuestion() {
  var q = quiz.questions[quiz.index];
  var player = QUIZ_PLAYERS[quiz.index % 2];
  quiz.answered = false;
  quiz.el.innerHTML =
    quizScoreboard() +
    '<div class="quiz-turn" style="color:' + player.color + '">' + player.name + "'s turn</div>" +
    '<div class="quiz-meta">Question ' + (quiz.index + 1) + " of " + quiz.questions.length +
    " · " + escapeHtml(q.topic) + (q.level ? " · " + escapeHtml(q.level) : "") + "</div>" +
    '<div class="quiz-question">' + escapeHtml(q.question) + "</div>" +
    '<div class="quiz-answers"></div>' +
    '<div class="quiz-timebar"><div></div></div>' +
    '<p class="quiz-note"></p>';
  if (quiz.startNote) { quizNote(quiz.startNote); quiz.startNote = ""; }

  var box = quiz.el.querySelector(".quiz-answers");
  var buttons = q.answers.map(function (a) {
    var b = quizButton(escapeHtml(a), function () { quizAnswer(a); }, "answer");
    b.answer = a;
    box.appendChild(b);
    return b;
  });
  quizSetRows([buttons.slice(0, 2), buttons.slice(2, 4)]);
  startQuizTimer();
}

function startQuizTimer() {
  clearInterval(quiz.timer);
  var bar = quiz.el.querySelector(".quiz-timebar");
  var seconds = [0, 20, 10][quiz.settings.timer];
  if (!seconds) { bar.style.visibility = "hidden"; return; }
  var ends = Date.now() + seconds * 1000;
  quiz.timer = setInterval(function () {
    var left = Math.max(0, ends - Date.now());
    bar.firstChild.style.width = (100 * left / (seconds * 1000)) + "%";
    if (!left) quizAnswer(null);
  }, 100);
}

function quizAnswer(a) {
  if (quiz.answered) return;
  quiz.answered = true;
  clearInterval(quiz.timer);
  var q = quiz.questions[quiz.index];
  var turn = quiz.index % 2;
  var right = a === q.answer;
  if (right) quiz.scores[turn]++;

  quiz.rows[0].concat(quiz.rows[1] || []).forEach(function (b) {
    if (b.answer === q.answer) b.classList.add("right");
    else if (b.answer === a) b.classList.add("wrong");
    b.onSelect = function () {};
  });
  var verdict = right ? "Correct! +1 for " + QUIZ_PLAYERS[turn].name :
    (a === null ? "Time's up! " : "Not quite. ") + "The answer was " + q.answer + ".";
  quiz.el.querySelector(".quiz-scores").outerHTML = quizScoreboard();
  quizNote("");

  var last = quiz.index + 1 >= quiz.questions.length;
  var next = quizButton(last ? "See who won" : "Next question", function () {
    quiz.index++;
    if (last) showQuizResults(); else showQuizQuestion();
  }, "big");
  var line = document.createElement("div");
  line.className = "quiz-verdict " + (right ? "yes" : "no");
  line.innerHTML = "<span>" + escapeHtml(verdict) + "</span>";
  line.appendChild(next);
  quiz.el.querySelector(".quiz-timebar").replaceWith(line);
  quizSetRows([[next]]);
}

function showQuizResults() {
  quiz.screen = "results";
  var s = quiz.scores;
  var headline = s[0] === s[1] ? "It's a tie!" :
    QUIZ_PLAYERS[s[0] > s[1] ? 0 : 1].name + " wins!";
  var color = s[0] === s[1] ? "#f4c6ec" : QUIZ_PLAYERS[s[0] > s[1] ? 0 : 1].color;
  quiz.el.innerHTML =
    '<h2 class="quiz-title" style="color:' + color + '">' + headline + "</h2>" +
    quizScoreboard() + '<div class="quiz-line quiz-actions"></div>';
  var box = quiz.el.querySelector(".quiz-actions");
  var buttons = [
    quizButton("Play again", startQuiz, "big"),
    quizButton("Change settings", showQuizSetup, "big"),
    quizButton("Back to the Mansion", closeScreen, "big")
  ];
  buttons.forEach(function (b) { box.appendChild(b); });
  quizSetRows([buttons]);
}
