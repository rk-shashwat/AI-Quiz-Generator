/* ==========================================================
   AI Quiz Generator — script.js
   Vanilla JS logic + Groq API integration
   ========================================================== */

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
// NOTE: Storing an API key in client-side JS means anyone who
// views the page source or devtools can see and use it.
// Fine for local/personal use — for a public deployment, route
// this request through your own backend so the key never
// reaches the browser.
const BACKEND_URL = "https://ai-tool-backend-dr0k.onrender.com/chat";
// ------------------------------------------------------------
// DOM REFERENCES
// ------------------------------------------------------------
const generatorCard = document.getElementById("generatorCard");
const topicInput = document.getElementById("topicInput");
const difficultySelect = document.getElementById("difficultySelect");
const questionCountSelect = document.getElementById("questionCountSelect");
const questionTypeSelect = document.getElementById("questionTypeSelect");
const languageSelect = document.getElementById("languageSelect");

const generateBtn = document.getElementById("generateBtn");
const clearBtn = document.getElementById("clearBtn");

const quizSection = document.getElementById("quizSection");
const quizForm = document.getElementById("quizForm");
const questionsContainer = document.getElementById("questionsContainer");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const submitQuizBtn = document.getElementById("submitQuizBtn");
const resetQuizBtn = document.getElementById("resetQuizBtn");

const resultSection = document.getElementById("resultSection");
const scoreRing = document.getElementById("scoreRing");
const scorePercentage = document.getElementById("scorePercentage");
const performanceMessage = document.getElementById("performanceMessage");
const statTotal = document.getElementById("statTotal");
const statCorrect = document.getElementById("statCorrect");
const statWrong = document.getElementById("statWrong");
const statScore = document.getElementById("statScore");
const explanationsContainer = document.getElementById("explanationsContainer");

const copyResultBtn = document.getElementById("copyResultBtn");
const downloadTxtBtn = document.getElementById("downloadTxtBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const newQuizBtn = document.getElementById("newQuizBtn");

const toastContainer = document.getElementById("toastContainer");

// Quiz state kept in memory
let currentQuestions = []; // [{ question, options, answer, explanation }]
let lastResultSummary = ""; // plain-text summary for copy/download

// ------------------------------------------------------------
// UTILITY: Toast notifications
// ------------------------------------------------------------
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ------------------------------------------------------------
// UTILITY: Toggle the loading state of the Generate button
// ------------------------------------------------------------
function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.classList.toggle("loading", isLoading);
  generateBtn.querySelector(".btn-label").textContent = isLoading
    ? "Generating..."
    : "Generate Quiz";
}

// ------------------------------------------------------------
// UTILITY: Escape HTML special characters
// ------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ------------------------------------------------------------
// UTILITY: Fisher-Yates shuffle (returns a new shuffled array)
// ------------------------------------------------------------
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ------------------------------------------------------------
// UTILITY: Build the prompt sent to the AI
// ------------------------------------------------------------
function buildPrompt(topic, difficulty, questionCount, questionType, language) {
  return `You are an expert educator.

Generate a quiz.

Topic:
${topic}

Difficulty:
${difficulty}

Number of Questions:
${questionCount}

Question Type:
${questionType}

Language:
${language}

Return ONLY valid JSON.

JSON Format:

[
  {
    "question":"...",
    "options":[
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "answer":"Option A",
    "explanation":"..."
  }
]

Rules:

Return only JSON.

No markdown.

No extra text.

No code block.`;
}

// ------------------------------------------------------------
// UTILITY: Extract and parse JSON from the AI's raw response
// The model sometimes wraps JSON in code fences despite
// instructions, so strip those before parsing.
// ------------------------------------------------------------
function parseQuizJson(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("empty");
  }

  parsed.forEach((q) => {
    if (
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      typeof q.answer !== "string"
    ) {
      throw new Error("shape");
    }
  });

  return parsed;
}

// ------------------------------------------------------------
// CORE: Call the Groq API and return the parsed quiz array
// ------------------------------------------------------------
async function fetchQuiz(prompt) {
  const response = await fetch(`${BACKEND_URL}/quiz-generator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt
    })
  });

  if (!response.ok) {
    throw new Error("Failed to generate quiz.");
  }

  const data = await response.json();

  return data.questions;
}

// ------------------------------------------------------------
// CORE: Render the quiz questions as interactive cards
// ------------------------------------------------------------
function renderQuiz(questions) {
  questionsContainer.innerHTML = "";

  questions.forEach((q, qIndex) => {
    const shuffledOptions = shuffleArray(q.options);

    const card = document.createElement("fieldset");
    card.className = "question-card";
    card.dataset.qIndex = qIndex;

    const legend = document.createElement("legend");
    legend.className = "visually-hidden";
    legend.textContent = `Question ${qIndex + 1}`;
    card.appendChild(legend);

    const numberBadge = document.createElement("div");
    numberBadge.className = "question-number";
    numberBadge.textContent = `Question ${qIndex + 1} of ${questions.length}`;
    card.appendChild(numberBadge);

    const questionText = document.createElement("p");
    questionText.className = "question-text";
    questionText.textContent = q.question;
    card.appendChild(questionText);

    const optionsList = document.createElement("div");
    optionsList.className = "options-list";
    optionsList.setAttribute("role", "radiogroup");

    shuffledOptions.forEach((optionText, oIndex) => {
      const optionId = `q${qIndex}_o${oIndex}`;
      const label = document.createElement("label");
      label.className = "option-label";
      label.setAttribute("for", optionId);

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `question-${qIndex}`;
      radio.id = optionId;
      radio.value = optionText;

      radio.addEventListener("change", () => {
        optionsList.querySelectorAll(".option-label").forEach((el) => el.classList.remove("selected"));
        label.classList.add("selected");
        updateProgress();
      });

      const span = document.createElement("span");
      span.textContent = optionText;

      label.appendChild(radio);
      label.appendChild(span);
      optionsList.appendChild(label);
    });

    card.appendChild(optionsList);
    questionsContainer.appendChild(card);
  });
}

// ------------------------------------------------------------
// CORE: Update the "X of Y answered" progress indicator
// ------------------------------------------------------------
function updateProgress() {
  const total = currentQuestions.length;
  const answered = new Set(
    Array.from(quizForm.querySelectorAll("input[type='radio']:checked")).map((el) => el.name)
  ).size;

  progressFill.style.width = total ? `${(answered / total) * 100}%` : "0%";
  progressLabel.textContent = `${answered} of ${total} answered`;
}

// ------------------------------------------------------------
// CORE: Handle the "Generate Quiz" action
// ------------------------------------------------------------
async function handleGenerate() {
  const topic = topicInput.value.trim();

  if (!topic) {
    showToast("Please enter a quiz topic.", "error");
    topicInput.focus();
    return;
  }

  const difficulty = difficultySelect.value;
  const questionCount = questionCountSelect.value;
  const questionType = questionTypeSelect.value;
  const language = languageSelect.value;

  const prompt = buildPrompt(topic, difficulty, questionCount, questionType, language);

  setLoading(true);
  quizSection.hidden = true;
  resultSection.hidden = true;

  try {
    const questions = await fetchQuiz(prompt);
    currentQuestions = questions;

    renderQuiz(currentQuestions);
    quizSection.hidden = false;
    updateProgress();
    quizSection.scrollIntoView({ behavior: "smooth", block: "start" });

    showToast(`Quiz generated with ${currentQuestions.length} questions!`, "success");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

// ------------------------------------------------------------
// CORE: Clear the generator form
// ------------------------------------------------------------
function handleClear() {
  topicInput.value = "";
  difficultySelect.value = "Medium";
  questionCountSelect.value = "5";
  questionTypeSelect.selectedIndex = 0;
  languageSelect.selectedIndex = 0;
  topicInput.focus();
}

// ------------------------------------------------------------
// CORE: Reset the quiz (clear selections, keep same questions)
// ------------------------------------------------------------
function handleResetQuiz() {
  quizForm.querySelectorAll("input[type='radio']").forEach((radio) => {
    radio.checked = false;
  });
  quizForm.querySelectorAll(".option-label").forEach((label) => {
    label.classList.remove("selected", "option-correct", "option-wrong", "option-disabled");
  });
  quizForm.querySelectorAll("input[type='radio']").forEach((radio) => {
    radio.disabled = false;
  });
  quizForm.querySelectorAll(".question-explanation").forEach((el) => el.remove());

  resultSection.hidden = true;
  updateProgress();
  showToast("Quiz reset. Good luck!", "info");
}

// ------------------------------------------------------------
// CORE: Handle quiz submission — score it and show results
// ------------------------------------------------------------
function handleSubmitQuiz(event) {
  event.preventDefault();

  let correctCount = 0;
  const explanationLines = [];

  currentQuestions.forEach((q, qIndex) => {
    const card = questionsContainer.querySelector(`.question-card[data-q-index="${qIndex}"]`);
    const selectedRadio = card.querySelector("input[type='radio']:checked");
    const selectedValue = selectedRadio ? selectedRadio.value : null;
    const isCorrect = selectedValue === q.answer;

    if (isCorrect) correctCount++;

    // Highlight options + disable further changes
    card.querySelectorAll(".option-label").forEach((label) => {
      const radio = label.querySelector("input[type='radio']");
      radio.disabled = true;
      label.classList.add("option-disabled");

      if (radio.value === q.answer) {
        label.classList.add("option-correct");
      } else if (radio.value === selectedValue && !isCorrect) {
        label.classList.add("option-wrong");
      }
    });

    // Append explanation block under the question
    const explanationBlock = document.createElement("div");
    explanationBlock.className = "question-explanation";
    explanationBlock.innerHTML = `<strong>${isCorrect ? "Correct" : "Incorrect"}.</strong> Correct answer: <strong>${escapeHtml(q.answer)}</strong>. ${escapeHtml(q.explanation || "")}`;
    card.appendChild(explanationBlock);

    explanationLines.push(
      `Q${qIndex + 1}: ${q.question}\nYour answer: ${selectedValue || "No answer"}\nCorrect answer: ${q.answer}\nResult: ${isCorrect ? "Correct" : "Incorrect"}\nExplanation: ${q.explanation || "N/A"}\n`
    );
  });

  const total = currentQuestions.length;
  const wrongCount = total - correctCount;
  const percentage = total ? Math.round((correctCount / total) * 100) : 0;

  let message = "Keep Practicing!";
  if (percentage >= 90) message = "Excellent!";
  else if (percentage >= 70) message = "Good Job!";
  else if (percentage >= 50) message = "Nice Effort!";

  // Populate result UI
  statTotal.textContent = total;
  statCorrect.textContent = correctCount;
  statWrong.textContent = wrongCount;
  statScore.textContent = `${correctCount}/${total}`;
  scorePercentage.textContent = `${percentage}%`;
  scoreRing.style.setProperty("--pct", percentage);
  performanceMessage.textContent = message;

  // Also mirror explanations into the result card for quick review
  explanationsContainer.innerHTML = "";
  currentQuestions.forEach((q, qIndex) => {
    const item = document.createElement("div");
    item.className = "question-explanation";
    item.innerHTML = `<strong>Q${qIndex + 1}.</strong> ${escapeHtml(q.question)}<br><strong>Answer:</strong> ${escapeHtml(q.answer)} — ${escapeHtml(q.explanation || "")}`;
    explanationsContainer.appendChild(item);
  });

  lastResultSummary =
    `AI Quiz Generator — Results\n` +
    `Topic: ${topicInput.value.trim()}\n` +
    `Total Questions: ${total}\nCorrect: ${correctCount}\nWrong: ${wrongCount}\nPercentage: ${percentage}%\nPerformance: ${message}\n\n` +
    `Explanations:\n\n` + explanationLines.join("\n");

  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------------
// CORE: Copy result summary to clipboard
// ------------------------------------------------------------
async function handleCopyResult() {
  if (!lastResultSummary) return;
  try {
    await navigator.clipboard.writeText(lastResultSummary);
    showToast("Result copied to clipboard!", "success");
  } catch (error) {
    showToast("Couldn't copy automatically. Please copy manually.", "error");
  }
}

// ------------------------------------------------------------
// CORE: Download result summary as a .txt file
// ------------------------------------------------------------
function handleDownloadTxt() {
  if (!lastResultSummary) return;

  const blob = new Blob([lastResultSummary], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "quiz-result.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
  showToast("Result downloaded as TXT!", "success");
}

// ------------------------------------------------------------
// CORE: Download result summary as a .pdf file
// ------------------------------------------------------------
function handleDownloadPdf() {
  if (!lastResultSummary) return;

  if (!window.jspdf) {
    showToast("PDF library failed to load. Please check your connection.", "error");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - margin * 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const lines = doc.splitTextToSize(lastResultSummary, maxLineWidth);
    let cursorY = margin;
    const lineHeight = 16;

    lines.forEach((line) => {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    });

    doc.save("quiz-result.pdf");
    showToast("Result downloaded as PDF!", "success");
  } catch (error) {
    showToast("Couldn't create the PDF. Please try again.", "error");
  }
}

// ------------------------------------------------------------
// CORE: Start over — go back to the generator form
// ------------------------------------------------------------
function handleNewQuiz() {
  quizSection.hidden = true;
  resultSection.hidden = true;
  currentQuestions = [];
  lastResultSummary = "";
  generatorCard.scrollIntoView({ behavior: "smooth", block: "start" });
  topicInput.focus();
}

// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------
generateBtn.addEventListener("click", handleGenerate);
clearBtn.addEventListener("click", handleClear);
quizForm.addEventListener("submit", handleSubmitQuiz);
resetQuizBtn.addEventListener("click", handleResetQuiz);

copyResultBtn.addEventListener("click", handleCopyResult);
downloadTxtBtn.addEventListener("click", handleDownloadTxt);
downloadPdfBtn.addEventListener("click", handleDownloadPdf);
newQuizBtn.addEventListener("click", handleNewQuiz);

// Keyboard shortcut: Ctrl/Cmd + Enter to generate (only while the
// generator form is the active view, so it doesn't clash with the quiz)
document.addEventListener("keydown", (event) => {
  const isCtrlEnter = (event.ctrlKey || event.metaKey) && event.key === "Enter";
  if (isCtrlEnter && quizSection.hidden) {
    event.preventDefault();
    handleGenerate();
  }
});
