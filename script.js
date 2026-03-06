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
const drumrollSfx = document.getElementById("drumroll-sfx");
const loadingPanel = document.getElementById("loading-panel");
const loadingLine = document.getElementById("loading-line");
const houseInsightTitle = document.getElementById("house-insight-title");
const houseQualities = document.getElementById("house-qualities");
const houseCharacters = document.getElementById("house-characters");
const AI_SORT_API_URL = window.SORTING_HAT_AI_ENDPOINT || "";
const AI_REQUEST_TIMEOUT_MS = 3200;

let latestResult = null;
let isSorting = false;
let loadingLineInterval = null;
let loadingSequenceTimers = [];
let musicUserEnabled = true;

const houseData = {
  gryffindor: {
    label: "Gryffindor",
    color: "#9d1b2e",
    line: "Your spark runs toward daring action, fierce heart, and bright courage under pressure."
  },
  slytherin: {
    label: "Slytherin",
    color: "#146242",
    line: "Your magic is strategic, ambitious, and quietly unstoppable when goals are on the line."
  },
  ravenclaw: {
    label: "Ravenclaw",
    color: "#1e407f",
    line: "Your mind leads with wit, curiosity, and inventive thinking that turns puzzles into pathways."
  },
  hufflepuff: {
    label: "Hufflepuff",
    color: "#ae862c",
    line: "Your strength is steady: loyal friendships, fair choices, and patient, grounded care."
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
const houseTraitMap = {
  gryffindor: "bravery",
  slytherin: "ambition",
  ravenclaw: "intellect",
  hufflepuff: "loyalty"
};

const sortingNarration = [
  "The brim twitches. Ancient whispers drift through the Great Hall...",
  "It studies your choices and weighs every hidden motive...",
  "It listens to your personality, your courage, your ambition...",
  "A decision flashes like wandlight. The hat has chosen."
];

const loadingReferences = [
  "Thinking...",
  "The hat is deciding...",
  "The hall holds its breath as magic gathers...",
  "The brim curls. A choice is about to be shouted."
];

const houseProfiles = {
  gryffindor: {
    title: "Gryffindor",
    qualities: ["Brave", "Courageous", "Daring"],
    characters: ["Harry Potter", "Hermione Granger", "Ron Weasley"],
    symbol: "🦁"
  },
  slytherin: {
    title: "Slytherin",
    qualities: ["Ambitious", "Resourceful", "Determined"],
    characters: ["Draco Malfoy", "Severus Snape", "Regulus Black"],
    symbol: "🐍"
  },
  ravenclaw: {
    title: "Ravenclaw",
    qualities: ["Wise", "Curious", "Inventive"],
    characters: ["Luna Lovegood", "Cho Chang", "Filius Flitwick"],
    symbol: "🦅"
  },
  hufflepuff: {
    title: "Hufflepuff",
    qualities: ["Loyal", "Patient", "Just"],
    characters: ["Cedric Diggory", "Nymphadora Tonks", "Newt Scamander"],
    symbol: "🦡"
  }
};

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

function traitsFromQuizAnswers(answers) {
  const traits = {
    bravery: 0,
    ambition: 0,
    intellect: 0,
    loyalty: 0
  };
  answers.forEach((house) => {
    const trait = houseTraitMap[house];
    if (trait) {
      traits[trait] += 2;
    }
  });
  return traits;
}

function mergeTraits(textTraits, quizTraits) {
  const merged = {
    bravery: textTraits.bravery + quizTraits.bravery,
    ambition: textTraits.ambition + quizTraits.ambition,
    intellect: textTraits.intellect + quizTraits.intellect,
    loyalty: textTraits.loyalty + quizTraits.loyalty
  };
  const total = Object.values(merged).reduce((sum, n) => sum + n, 0) || 1;
  const normalized = Object.fromEntries(
    Object.entries(merged).map(([trait, value]) => [trait, Math.round((value / total) * 100)])
  );
  return { raw: merged, normalized };
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

function normalizeHouseId(value) {
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  if (normalized.includes("gryff")) return "gryffindor";
  if (normalized.includes("slyth")) return "slytherin";
  if (normalized.includes("raven")) return "ravenclaw";
  if (normalized.includes("huffle")) return "hufflepuff";
  return null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function sanitizeTraitPercents(traits) {
  if (!traits || typeof traits !== "object") return null;
  const raw = {
    bravery: Number(traits.bravery) || 0,
    ambition: Number(traits.ambition) || 0,
    intellect: Number(traits.intellect) || 0,
    loyalty: Number(traits.loyalty) || 0
  };
  const total = Object.values(raw).reduce((sum, n) => sum + n, 0);
  if (!total) return null;
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Math.round((value / total) * 100)])
  );
  return { raw, normalized };
}

async function requestAiSorting(studentName, answers, traitsText) {
  if (!AI_SORT_API_URL) return null;
  try {
    const response = await fetchWithTimeout(
      AI_SORT_API_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, answers, traitsText })
      },
      AI_REQUEST_TIMEOUT_MS
    );

    if (!response.ok) return null;
    const data = await response.json();
    const houseId = normalizeHouseId(data.house);
    if (!houseId) return null;

    return {
      houseId,
      confidence: Number(data.confidence) || null,
      explanation: typeof data.explanation === "string" ? data.explanation.trim() : "",
      traits: sanitizeTraitPercents(data.traits)
    };
  } catch {
    return null;
  }
}

function buildAnalysisLine(studentName, personality, confidence) {
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

function renderHouseProfile(houseId) {
  const profile = houseProfiles[houseId];
  if (!profile) return;

  houseInsightTitle.textContent = profile.title;
  houseQualities.innerHTML = "";
  profile.qualities.forEach((quality) => {
    const pill = document.createElement("span");
    pill.className = "quality-pill";
    pill.textContent = quality;
    houseQualities.appendChild(pill);
  });
  houseCharacters.textContent = `Characters: ${profile.characters.join(" • ")}`;
}

function startAmbience() {
  if (!bgMusic) return;
  bgMusic.volume = 0.34;
  const playPromise = bgMusic.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
  musicToggleBtn.textContent = "Music: Off";
}

function stopAmbience() {
  if (!bgMusic) return;
  bgMusic.pause();
  musicToggleBtn.textContent = "Music: On";
}

function playDrumroll() {
  if (!drumrollSfx) return;
  drumrollSfx.loop = true;
  drumrollSfx.currentTime = 0;
  const playPromise = drumrollSfx.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function stopDrumroll() {
  if (!drumrollSfx) return;
  drumrollSfx.loop = false;
  drumrollSfx.pause();
  drumrollSfx.currentTime = 0;
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

function startLoadingReferences() {
  if (!loadingLine) return;
  stopLoadingReferences();
  loadingPanel.classList.remove("final-call");
  loadingLine.textContent = loadingReferences[0];

  loadingSequenceTimers.push(
    window.setTimeout(() => {
      loadingLine.textContent = loadingReferences[1];
    }, 1300)
  );

  loadingSequenceTimers.push(
    window.setTimeout(() => {
      loadingLine.textContent = loadingReferences[2];
      hatStage.classList.add("sorting-intense");
    }, 3000)
  );

  loadingSequenceTimers.push(
    window.setTimeout(() => {
      loadingLine.textContent = loadingReferences[3];
    }, 4600)
  );
}

function announceHouseCall(houseLabel) {
  if (!loadingLine || !loadingPanel) return;
  loadingPanel.classList.add("final-call");
  loadingLine.textContent = `✨ ${houseLabel.toUpperCase()} ✨`;
}

function stopLoadingReferences(resetText = true) {
  if (loadingLineInterval) {
    window.clearInterval(loadingLineInterval);
    loadingLineInterval = null;
  }
  loadingSequenceTimers.forEach((timerId) => window.clearTimeout(timerId));
  loadingSequenceTimers = [];
  loadingPanel.classList.remove("final-call");
  if (resetText && loadingLine) {
    loadingLine.textContent = "The hat is deciding...";
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
  ctx.font = "46px Cormorant Garamond, serif";
  wrapText(ctx, `${studentName}: ${house.line}`, 84, 420, 920, 56);

  ctx.fillStyle = "rgba(248, 235, 205, 0.95)";
  ctx.font = "34px Cormorant Garamond, serif";
  wrapText(ctx, analysis, 84, 650, 920, 42);

  ctx.fillStyle = "rgba(248, 235, 205, 0.9)";
  ctx.font = "31px Cormorant Garamond, serif";
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

async function shareHouseResult() {
  if (!latestResult) return;
  const profile = houseProfiles[latestResult.house.label.toLowerCase()] || {};
  const symbol = profile.symbol || "✨";
  const url = window.location.href;
  const text = `I got ${latestResult.house.label}! ${symbol}\nTry the sorting hat here: ${url}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Harry Potter Sorting Hat Result",
        text,
        url
      });
      return;
    } catch {
      return;
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = "Copied to clipboard!";
      window.setTimeout(() => {
        shareBtn.textContent = "Share my house 🧙‍♂️";
      }, 1600);
      return;
    } catch {
      // ignore and fallback
    }
  }

  window.prompt("Copy your result:", text);
}

form.addEventListener("submit", async (event) => {
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

  const textPersonality = analyzePersonality(traitsText);
  const quizTraits = traitsFromQuizAnswers(answers);
  const personality = mergeTraits(textPersonality.raw, quizTraits);
  const localResult = calculateHouse(answers, textPersonality);
  const aiDecision = await requestAiSorting(studentName, answers, traitsText);
  const winnerId = aiDecision?.houseId || localResult.winnerId;
  const house = houseData[winnerId];
  const confidence = aiDecision?.confidence || localResult.confidence;
  const displayPersonality = aiDecision?.traits || personality;
  const analysis =
    aiDecision?.explanation ||
    buildAnalysisLine(studentName, displayPersonality, confidence);

  latestResult = {
    studentName,
    house,
    confidence,
    analysis,
    personality: displayPersonality,
    scores: localResult.totalScores
  };

  hatStage.classList.add("sorting");
  startSortingNarration();
  stopAmbience();
  playDrumroll();

  loadingSequenceTimers.push(
    window.setTimeout(() => {
      announceHouseCall(house.label);
    }, 5600)
  );

  window.setTimeout(() => {
    stopDrumroll();

    houseName.textContent = `${house.label.toUpperCase()}!`;
    houseName.style.color = house.color;
    houseLine.textContent = `${studentName}, ${house.line}`;
    analysisLine.textContent = analysis;

    renderTraitBars(displayPersonality);
    renderHouseScores(localResult.totalScores);
    renderHouseProfile(winnerId);

    stopLoadingReferences(false);
    loadingPanel.classList.add("hidden");
    quizCard.classList.add("hidden");
    resultCard.classList.remove("hidden");
    activateHouseScene(winnerId);

    if (musicUserEnabled) {
      startAmbience();
    }

    shareBtn.disabled = false;
    submitBtn.disabled = false;
    hatStage.classList.remove("sorting");
    hatStage.classList.remove("sorting-intense");
    narration.textContent = `The hall erupts in applause for ${studentName}.`;
    isSorting = false;
  }, 6400);
});

retryBtn.addEventListener("click", () => {
  form.reset();
  stopDrumroll();
  stopLoadingReferences();
  clearHouseScene();
  resultCard.classList.add("hidden");
  quizCard.classList.remove("hidden");
  loadingPanel.classList.add("hidden");
  form.classList.remove("hidden");
  hatStage.classList.remove("sorting");
  hatStage.classList.remove("sorting-intense");
  if (musicUserEnabled) {
    startAmbience();
  }
  narration.textContent = "The hat yawns awake and waits for the next witch or wizard...";
  latestResult = null;
});

shareBtn.addEventListener("click", shareHouseResult);

musicToggleBtn.addEventListener("click", () => {
  if (bgMusic && !bgMusic.paused) {
    musicUserEnabled = false;
    stopAmbience();
  } else {
    musicUserEnabled = true;
    startAmbience();
  }
});

window.addEventListener("load", () => {
  musicUserEnabled = true;
  startAmbience();
});

window.addEventListener(
  "pointerdown",
  () => {
    if (musicUserEnabled && bgMusic && bgMusic.paused && !isSorting) {
      startAmbience();
    }
  },
  { once: true }
);
