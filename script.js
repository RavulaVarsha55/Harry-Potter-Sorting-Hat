const form = document.getElementById("quiz-form");
const quizCard = document.getElementById("quiz-card");
const resultCard = document.getElementById("result-card");
const hatStage = document.getElementById("hat-stage");
const narration = document.getElementById("narration");
const houseName = document.getElementById("house-name");
const houseLine = document.getElementById("house-line");
const analysisLine = document.getElementById("analysis-line");
const traitBreakdown = document.getElementById("trait-breakdown");
const scoreBreakdown = document.getElementById("score-breakdown");
const shareBtn = document.getElementById("share-btn");
const retryBtn = document.getElementById("retry-btn");
const shareCanvas = document.getElementById("share-canvas");
const submitBtn = document.getElementById("submit-btn");
const musicToggleBtn = document.getElementById("music-toggle");
const bgMusic = document.getElementById("bg-music");
const loadingPanel = document.getElementById("loading-panel");
const loadingLine = document.getElementById("loading-line");

let latestResult = null;
let isSorting = false;
let audioContext = null;
let resultSparkleInterval = null;
let musicStarted = false;
let loadingLineInterval = null;

const houseData = {
  gryffindor: {
    label: "Gryffindor",
    color: "#9d1b2e",
    line: "Your spark runs toward daring action, fierce heart, and bright courage under pressure.",
    focus: "bravery"
  },
  slytherin: {
    label: "Slytherin",
    color: "#146242",
    line: "Your magic is strategic, ambitious, and quietly unstoppable when goals are on the line.",
    focus: "ambition"
  },
  ravenclaw: {
    label: "Ravenclaw",
    color: "#1e407f",
    line: "Your mind leads with wit, curiosity, and inventive thinking that turns puzzles into pathways.",
    focus: "intellect"
  },
  hufflepuff: {
    label: "Hufflepuff",
    color: "#ae862c",
    line: "Your strength is steady: loyal friendships, fair choices, and patient, grounded care.",
    focus: "loyalty"
  }
};

const traitKeywords = {
  bravery: ["brave", "courage", "bold", "risk", "fearless", "protect", "defend", "stand up", "danger", "duel"],
  ambition: ["ambition", "goal", "win", "influence", "lead", "success", "strategy", "power", "achieve", "resourceful"],
  intellect: ["learn", "study", "logic", "curious", "ideas", "analyze", "knowledge", "creative", "question", "research"],
  loyalty: ["loyal", "kind", "fair", "friend", "support", "patience", "help", "team", "trust", "care"]
};

const traitHouseMap = {
  bravery: "gryffindor",
  ambition: "slytherin",
  intellect: "ravenclaw",
  loyalty: "hufflepuff"
};

const sortingNarration = [
  "The brim twitches. Ancient whispers drift through the Great Hall...",
  "It studies your choices and weighs every hidden motive...",
  "It listens to your personality, your courage, your ambition...",
  "A decision flashes like wandlight. The hat has chosen."
];

const loadingReferences = [
  "The portraits lean closer. The castle is listening.",
  "An owl swoops by with a note marked: 'House decision pending.'",
  "A phoenix-feather flickers and the Great Hall falls silent.",
  "The hat mutters about courage, wit, loyalty, and ambition..."
];

function createEmptyHouseScores() {
  return {
    gryffindor: 0,
    slytherin: 0,
    ravenclaw: 0,
    hufflepuff: 0
  };
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function analyzePersonality(text) {
  const normalized = normalizeText(text);
  const words = normalized ? normalized.split(" ") : [];
  const traits = {
    bravery: 0,
    ambition: 0,
    intellect: 0,
    loyalty: 0
  };

  Object.entries(traitKeywords).forEach(([trait, keywords]) => {
    keywords.forEach((word) => {
      if (normalized.includes(word)) {
        traits[trait] += 1;
      }
    });
  });

  const intensityBoost = Math.min(3, (text.match(/!/g) || []).length);
  const reflectionBoost = Math.min(3, (text.match(/\b(i think|i believe|i feel|i try|i usually)\b/gi) || []).length);
  const depthBoost = Math.min(3, Math.floor(words.length / 40));

  traits.bravery += Math.ceil(intensityBoost / 2);
  traits.intellect += depthBoost;
  traits.loyalty += reflectionBoost > 0 ? 1 : 0;
  traits.ambition += /\b(best|top|greatest|master|excel)\b/i.test(text) ? 2 : 0;

  const total = Object.values(traits).reduce((sum, n) => sum + n, 0) || 1;
  const normalizedTraits = Object.fromEntries(
    Object.entries(traits).map(([trait, value]) => [trait, Math.round((value / total) * 100)])
  );

  return { raw: traits, normalized: normalizedTraits };
}

function calculateHouse(quizAnswers, personality) {
  const quizScores = createEmptyHouseScores();
  const aiScores = createEmptyHouseScores();

  quizAnswers.forEach((house) => {
    if (house in quizScores) {
      quizScores[house] += 6;
    }
  });

  Object.entries(personality.raw).forEach(([trait, value]) => {
    const house = traitHouseMap[trait];
    aiScores[house] += value * 2;
  });

  const totalScores = createEmptyHouseScores();
  Object.keys(totalScores).forEach((house) => {
    totalScores[house] = quizScores[house] + aiScores[house];
  });

  const sorted = Object.entries(totalScores).sort((a, b) => b[1] - a[1]);
  const [winnerId, winnerScore] = sorted[0];
  const runnerUpScore = sorted[1]?.[1] ?? 0;

  const confidence = Math.min(100, Math.max(55, Math.round(60 + ((winnerScore - runnerUpScore) / (winnerScore || 1)) * 45)));

  return {
    winnerId,
    totalScores,
    quizScores,
    aiScores,
    confidence
  };
}

function getDominantTraits(normalizedTraits) {
  return Object.entries(normalizedTraits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([trait]) => trait);
}

function titleCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildAnalysisLine(studentName, house, personality, confidence) {
  const topTraits = getDominantTraits(personality.normalized).map(titleCase);
  return `${studentName}, the hat detects strong ${topTraits.join(" + ")} patterns in your writing. House affinity confidence: ${confidence}%.`;
}

function renderTraitBars(personality) {
  traitBreakdown.innerHTML = "";
  Object.entries(personality.normalized)
    .sort((a, b) => b[1] - a[1])
    .forEach(([trait, value]) => {
      const row = document.createElement("div");
      row.className = "trait-row";

      const label = document.createElement("div");
      label.className = "trait-label";
      label.innerHTML = `<span>${titleCase(trait)}</span><span>${value}%</span>`;

      const track = document.createElement("div");
      track.className = "trait-track";

      const fill = document.createElement("div");
      fill.className = "trait-fill";
      fill.style.width = `${Math.max(8, value)}%`;

      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      traitBreakdown.appendChild(row);
    });
}

function renderHouseScores(scores) {
  scoreBreakdown.innerHTML = "";
  Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .forEach(([houseId, score]) => {
      const row = document.createElement("div");
      row.className = "house-score";
      row.style.borderLeft = `4px solid ${houseData[houseId].color}`;
      row.textContent = `${houseData[houseId].label}: ${score} enchanted points`;
      scoreBreakdown.appendChild(row);
    });
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
}

function playSoftTone(ctx, frequency, start, duration, type, gainLevel) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainLevel, start + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSortingChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  const start = ctx.currentTime;
  const notes = [392, 523.25, 659.25, 783.99, 659.25, 523.25];

  notes.forEach((frequency, i) => {
    playSoftTone(ctx, frequency, start + i * 0.12, 0.34, "triangle", 0.085);
  });
}

function playSpellSpark() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  const now = ctx.currentTime;
  [1174.66, 1567.98].forEach((freq, idx) => {
    playSoftTone(ctx, freq, now + idx * 0.06, 0.28, "sine", 0.05);
  });
}

function playResultSparkle() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  const now = ctx.currentTime;
  const highNotes = [987.77, 1174.66, 1318.51, 1567.98];
  const chosen = highNotes[Math.floor(Math.random() * highNotes.length)];
  playSoftTone(ctx, chosen, now, 0.26, "sine", 0.03);
  playSoftTone(ctx, chosen * 1.5, now + 0.04, 0.2, "triangle", 0.015);
}

function scheduleAmbience() {
  if (!bgMusic) return;
  bgMusic.volume = 0.34;
  const playPromise = bgMusic.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function startAmbience() {
  if (!bgMusic) return;
  if (!bgMusic.paused) return;
  scheduleAmbience();
  musicToggleBtn.textContent = "Music: Off";
  musicStarted = true;
}

function stopAmbience() {
  if (bgMusic) {
    bgMusic.pause();
  }
  musicToggleBtn.textContent = "Music: On";
}

function activateHouseScene(houseId) {
  const body = document.body;
  body.classList.add("showing-result");
  body.classList.remove("house-gryffindor", "house-slytherin", "house-ravenclaw", "house-hufflepuff");
  body.classList.add(`house-${houseId}`);
}

function clearHouseScene() {
  const body = document.body;
  body.classList.remove("showing-result", "house-gryffindor", "house-slytherin", "house-ravenclaw", "house-hufflepuff");
}

function resumeQuizMusic() {
  if (!musicStarted) return;
  if (!bgMusic) return;
  if (!bgMusic.paused) return;
  startAmbience();
}

function startResultSparkles() {
  stopResultSparkles();
  resultSparkleInterval = window.setInterval(() => {
    if (Math.random() > 0.42) {
      playResultSparkle();
    }
  }, 900);
}

function stopResultSparkles() {
  if (resultSparkleInterval) {
    window.clearInterval(resultSparkleInterval);
    resultSparkleInterval = null;
  }
}

function startLoadingReferences() {
  if (!loadingLine) return;
  let idx = 0;
  loadingLine.textContent = loadingReferences[idx];
  if (loadingLineInterval) {
    window.clearInterval(loadingLineInterval);
  }
  loadingLineInterval = window.setInterval(() => {
    idx = (idx + 1) % loadingReferences.length;
    loadingLine.textContent = loadingReferences[idx];
  }, 700);
}

function stopLoadingReferences() {
  if (loadingLineInterval) {
    window.clearInterval(loadingLineInterval);
    loadingLineInterval = null;
  }
  if (loadingLine) {
    loadingLine.textContent = "The Sorting Hat whispers, \"Hmm... difficult. Very difficult...\"";
  }
}

function updateNarration(index) {
  if (index < sortingNarration.length) {
    narration.textContent = sortingNarration[index];
  }
}

function startSortingNarration() {
  updateNarration(0);
  sortingNarration.slice(1).forEach((_, index) => {
    window.setTimeout(() => updateNarration(index + 1), (index + 1) * 680);
  });
}

function drawShareCard() {
  if (!latestResult) return;

  const ctx = shareCanvas.getContext("2d");
  const { studentName, house, confidence, analysis, scores } = latestResult;
  const orderedScores = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([houseId, score]) => `${houseData[houseId].label}: ${score}`)
    .join("  •  ");

  ctx.clearRect(0, 0, 1080, 1080);

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, "#080611");
  gradient.addColorStop(0.48, "#1d1433");
  gradient.addColorStop(1, house.color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = "rgba(227, 200, 132, 0.2)";
  ctx.beginPath();
  ctx.arc(830, 220, 205, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8ebcd";
  ctx.font = "700 54px Cinzel, serif";
  ctx.fillText("THE SORTING HAT HAS CHOSEN", 84, 145);

  ctx.fillStyle = house.color;
  ctx.font = "800 120px Cinzel, serif";
  ctx.fillText(house.label.toUpperCase(), 84, 320);

  ctx.fillStyle = "#faecc8";
  ctx.font = "46px Lora, serif";
  wrapText(ctx, `${studentName}: ${house.line}`, 84, 420, 920, 56);

  ctx.fillStyle = "rgba(248, 235, 205, 0.95)";
  ctx.font = "34px Lora, serif";
  wrapText(ctx, analysis, 84, 650, 920, 42);

  ctx.fillStyle = "rgba(248, 235, 205, 0.9)";
  ctx.font = "31px Lora, serif";
  wrapText(ctx, `${orderedScores}  •  Confidence: ${confidence}%`, 84, 810, 920, 40);

  ctx.fillStyle = "#dfbf7d";
  ctx.font = "600 36px Cinzel, serif";
  ctx.fillText("Harry Potter Sorting Hat App", 84, 980);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let yPos = y;

  words.forEach((word) => {
    const candidate = `${line}${word} `;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, yPos);
      line = `${word} `;
      yPos += lineHeight;
    } else {
      line = candidate;
    }
  });

  if (line) {
    ctx.fillText(line.trim(), x, yPos);
  }
}

function downloadShareCard() {
  drawShareCard();
  const link = document.createElement("a");
  link.href = shareCanvas.toDataURL("image/png");
  link.download = "hogwarts-sorting-result.png";
  link.click();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isSorting) return;

  const formData = new FormData(form);
  const studentName = (formData.get("studentName") || "Young Wizard").toString().trim();
  const answers = ["q1", "q2", "q3", "q4", "q5"].map((id) => formData.get(id));
  const traitsText = (formData.get("traits") || "").toString().trim();

  if (!studentName || !traitsText) return;

  isSorting = true;
  submitBtn.disabled = true;
  shareBtn.disabled = true;
  form.classList.add("hidden");
  loadingPanel.classList.remove("hidden");
  startLoadingReferences();

  const personality = analyzePersonality(traitsText);
  const result = calculateHouse(answers, personality);
  const house = houseData[result.winnerId];
  const analysis = buildAnalysisLine(studentName, house, personality, result.confidence);

  latestResult = {
    studentName,
    house,
    confidence: result.confidence,
    analysis,
    personality,
    scores: result.totalScores
  };

  hatStage.classList.add("sorting");
  startSortingNarration();
  playSortingChime();

  window.setTimeout(() => {
    houseName.textContent = `${house.label.toUpperCase()}!`;
    houseName.style.color = house.color;
    houseLine.textContent = `${studentName}, ${house.line}`;
    analysisLine.textContent = analysis;

    renderTraitBars(personality);
    renderHouseScores(result.totalScores);

    stopLoadingReferences();
    loadingPanel.classList.add("hidden");
    quizCard.classList.add("hidden");
    resultCard.classList.remove("hidden");
    stopAmbience();
    activateHouseScene(result.winnerId);
    startResultSparkles();
    playResultSparkle();
    shareBtn.disabled = false;
    submitBtn.disabled = false;
    hatStage.classList.remove("sorting");
    narration.textContent = `The hall erupts in applause for ${studentName}.`;
    isSorting = false;
  }, 2600);
});

retryBtn.addEventListener("click", () => {
  form.reset();
  stopResultSparkles();
  stopLoadingReferences();
  clearHouseScene();
  resultCard.classList.add("hidden");
  quizCard.classList.remove("hidden");
  loadingPanel.classList.add("hidden");
  form.classList.remove("hidden");
  resumeQuizMusic();
  narration.textContent = "The hat yawns awake and waits for the next witch or wizard...";
  latestResult = null;
});

shareBtn.addEventListener("click", downloadShareCard);

musicToggleBtn.addEventListener("click", () => {
  if (bgMusic && !bgMusic.paused) {
    stopAmbience();
  } else {
    startAmbience();
  }
});

window.addEventListener("load", () => {
  startAmbience();
});

window.addEventListener(
  "pointerdown",
  () => {
    if (bgMusic && bgMusic.paused) {
      startAmbience();
    }
  },
  { once: true }
);
