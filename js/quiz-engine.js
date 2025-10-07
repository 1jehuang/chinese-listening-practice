// Shared Quiz Engine
// Used by all quiz pages (character sheets, lessons, practice tests)
// Each page only needs to define characters array and call initQuiz()

// Quiz state
let currentQuestion = null;
let mode = 'char-to-pinyin';
let answered = false;
let score = 0;
let total = 0;
let enteredSyllables = [];
let quizCharacters = [];
let config = {};

// DOM elements (initialized in initQuiz)
let questionDisplay, answerInput, checkBtn, feedback, hint;
let typeMode, choiceMode, strokeOrderMode, handwritingMode, drawCharMode;
let audioSection;

// =============================================================================
// PINYIN UTILITIES
// =============================================================================

function convertPinyinToToneNumbers(pinyin) {
    const toneMap = {
        'ā': 'a1', 'á': 'a2', 'ǎ': 'a3', 'à': 'a4',
        'ē': 'e1', 'é': 'e2', 'ě': 'e3', 'è': 'e4',
        'ī': 'i1', 'í': 'i2', 'ǐ': 'i3', 'ì': 'i4',
        'ō': 'o1', 'ó': 'o2', 'ǒ': 'o3', 'ò': 'o4',
        'ū': 'u1', 'ú': 'u2', 'ǔ': 'u3', 'ù': 'u4',
        'ǖ': 'v1', 'ǘ': 'v2', 'ǚ': 'v3', 'ǜ': 'v4',
        'ü': 'v'
    };

    let result = pinyin.toLowerCase();
    for (const [marked, numbered] of Object.entries(toneMap)) {
        result = result.replace(new RegExp(marked, 'g'), numbered);
    }
    return result;
}

function splitPinyinSyllables(pinyin) {
    // Handle: "zhong1 guo2", "zhong1guo2", "zhong.guo", "Zhōng.guo", "Zhōngguó"
    let text = pinyin.trim();

    // If has spaces or dots, split on them
    if (text.includes(' ') || text.includes('.')) {
        return text.split(/[\s.]+/);
    }

    // Convert to tone numbers first if it has tone marks
    const withNumbers = convertPinyinToToneNumbers(text);

    // Split after tone numbers (1-4)
    const matches = withNumbers.match(/[a-zv]+[1-4]/gi);
    if (matches) {
        return matches;
    }

    // If no tone numbers, return as single syllable
    return [text];
}

function checkPinyinMatch(userAnswer, correct) {
    const user = userAnswer.toLowerCase().trim();
    const correctLower = correct.toLowerCase().trim();

    // Direct match with tone marks
    if (user === correctLower) return true;

    // Convert correct pinyin to tone numbers for comparison
    const correctWithNumbers = convertPinyinToToneNumbers(correctLower);

    // Check if user input matches when both are in tone number format
    if (user === correctWithNumbers) return true;

    // Also check without spaces
    const userNoSpaces = user.replace(/\s+/g, '');
    const correctNoSpaces = correctLower.replace(/\s+/g, '');
    const correctWithNumbersNoSpaces = correctWithNumbers.replace(/\s+/g, '');

    if (userNoSpaces === correctNoSpaces || userNoSpaces === correctWithNumbersNoSpaces) return true;

    return false;
}

function getPartialMatch(userAnswer, correct) {
    const user = userAnswer.toLowerCase().trim();
    const correctLower = correct.toLowerCase().trim();
    const correctWithNumbers = convertPinyinToToneNumbers(correctLower);

    // Split into syllables (handles both spaced and non-spaced)
    const correctSyllables = splitPinyinSyllables(correctLower);
    const correctNumberSyllables = splitPinyinSyllables(correctWithNumbers);
    const userSyllables = splitPinyinSyllables(user);

    let matched = [];
    let allCorrect = true;

    for (let i = 0; i < userSyllables.length; i++) {
        if (i >= correctSyllables.length) {
            allCorrect = false;
            break;
        }

        const userSyl = userSyllables[i];
        const correctSyl = correctSyllables[i];
        const correctNumSyl = correctNumberSyllables[i];

        if (userSyl === correctSyl || userSyl === correctNumSyl) {
            matched.push(correctSyl);
        } else {
            allCorrect = false;
            break;
        }
    }

    return {
        matched,
        isComplete: matched.length === correctSyllables.length && allCorrect,
        isPartialCorrect: matched.length > 0 && allCorrect,
        totalSyllables: correctSyllables.length
    };
}

function updatePartialProgress() {
    if ((mode !== 'char-to-pinyin' && mode !== 'audio-to-pinyin') || answered) return;

    const userAnswer = answerInput.value.trim();
    if (!userAnswer) {
        hint.textContent = '';
        hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px]';
        return;
    }

    const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim());

    for (const option of pinyinOptions) {
        const partial = getPartialMatch(userAnswer, option);

        if (partial.isPartialCorrect) {
            const remaining = option.split(/\s+/).slice(partial.matched.length).join(' ');
            hint.textContent = `✓ ${partial.matched.join(' ')}${remaining ? ' | ' + remaining : ''}`;
            hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px] text-blue-600';
            return;
        }
    }

    hint.textContent = '';
    hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px]';
}

// =============================================================================
// QUIZ LOGIC
// =============================================================================

function generateQuestion() {
    enteredSyllables = [];
    answered = false;
    feedback.textContent = '';
    hint.textContent = '';
    answerInput.value = '';

    currentQuestion = quizCharacters[Math.floor(Math.random() * characters.length)];

    // Hide all mode containers
    typeMode.style.display = 'none';
    if (choiceMode) choiceMode.style.display = 'none';
    if (strokeOrderMode) strokeOrderMode.style.display = 'none';
    if (handwritingMode) handwritingMode.style.display = 'none';
    if (drawCharMode) drawCharMode.style.display = 'none';
    if (audioSection) audioSection.classList.add('hidden');

    // Show appropriate UI based on mode
    if (mode === 'char-to-pinyin') {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div><div style="text-align: center; color: #999; font-size: 14px; margin-top: -20px;">Type with tone marks (mǎ) or numbers (ma3)</div>`;
        typeMode.style.display = 'block';
        setTimeout(() => answerInput.focus(), 100);
    } else if (mode === 'audio-to-pinyin' && audioSection) {
        questionDisplay.innerHTML = `<div class="text-center text-6xl my-8 font-bold text-gray-700">🔊 Listen</div>`;
        typeMode.style.display = 'block';
        audioSection.classList.remove('hidden');
        setupAudioMode();
        setTimeout(() => answerInput.focus(), 100);
    } else if (mode === 'char-to-pinyin-mc' && choiceMode) {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div>`;
        generatePinyinOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'pinyin-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 48px; margin: 40px 0;">${currentQuestion.pinyin}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'char-to-meaning' && choiceMode) {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div>`;
        generateMeaningOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'meaning-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 40px 0;">${currentQuestion.meaning}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
    }
}

function setupAudioMode() {
    const playBtn = document.getElementById('playAudioBtn');
    if (!playBtn) return;

    const pinyinOptions = currentQuestion.pinyin.split('/');
    const firstPinyin = pinyinOptions[0].trim();

    window.currentAudioPlayFunc = () => {
        playPinyinAudio(firstPinyin, currentQuestion.char);
    };

    playBtn.onclick = window.currentAudioPlayFunc;

    // Auto-play once
    setTimeout(() => {
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }, 200);
}

function checkAnswer() {
    if (!answerInput.value.trim()) return;

    const userAnswer = answerInput.value.trim();

    if (mode === 'char-to-pinyin' || mode === 'audio-to-pinyin') {
        const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim());

        // Check if full answer is entered
        const fullMatch = pinyinOptions.some(option => checkPinyinMatch(userAnswer, option));

        if (fullMatch) {
            handleCorrectFullAnswer();
            return;
        }

        // Check if single syllable matches next expected syllable
        let syllableMatched = false;
        for (const option of pinyinOptions) {
            const syllables = splitPinyinSyllables(option);
            const optionWithNumbers = convertPinyinToToneNumbers(option);
            const syllablesWithNumbers = splitPinyinSyllables(optionWithNumbers);

            if (enteredSyllables.length < syllables.length) {
                const expectedSyllable = syllables[enteredSyllables.length];
                const expectedSyllableWithNumbers = syllablesWithNumbers[enteredSyllables.length];

                // Check if user's input matches expected syllable (with or without tone numbers)
                const userLower = userAnswer.toLowerCase();
                const expectedLower = expectedSyllable.toLowerCase();
                const expectedNumLower = expectedSyllableWithNumbers.toLowerCase();

                if (userLower === expectedLower || userLower === expectedNumLower) {
                    handleCorrectSyllable(syllables, option);
                    syllableMatched = true;
                    break;
                }
            }
        }

        if (!syllableMatched) {
            handleWrongAnswer();
        }
    }
}

function handleCorrectFullAnswer() {
    if (mode === 'char-to-pinyin') {
        const firstPinyin = currentQuestion.pinyin.split('/')[0].trim();
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }

    playCorrectSound();
    if (!answered) {
        answered = true;
        total++;
        score++;
    }

    if (mode === 'audio-to-pinyin') {
        feedback.textContent = `✓ Correct! ${currentQuestion.pinyin} (${currentQuestion.char})`;
    } else {
        feedback.textContent = `✓ Correct! ${currentQuestion.char} = ${currentQuestion.pinyin}`;
    }
    feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-green-600';
    hint.textContent = `Meaning: ${currentQuestion.meaning}`;
    hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px] text-green-600';

    updateStats();
    setTimeout(() => generateQuestion(), 300);
}

function handleCorrectSyllable(syllables, fullPinyin) {
    enteredSyllables.push(syllables[enteredSyllables.length]);
    answerInput.value = '';

    if (enteredSyllables.length === syllables.length) {
        // All syllables entered - complete!
        if (mode === 'char-to-pinyin') {
            playPinyinAudio(fullPinyin, currentQuestion.char);
        }

        playCorrectSound();
        if (!answered) {
            answered = true;
            total++;
            score++;
        }

        if (mode === 'audio-to-pinyin') {
            feedback.textContent = `✓ Correct! ${currentQuestion.pinyin} (${currentQuestion.char})`;
        } else {
            feedback.textContent = `✓ Correct! ${currentQuestion.char} = ${currentQuestion.pinyin}`;
        }
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-green-600';
        hint.textContent = `Meaning: ${currentQuestion.meaning}`;
        hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px] text-green-600';

        updateStats();
        setTimeout(() => generateQuestion(), 300);
    } else {
        // More syllables needed
        const remaining = syllables.slice(enteredSyllables.length).join(' ');
        hint.textContent = `✓ ${enteredSyllables.join(' ')} | ${remaining}`;
        hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px] text-green-600';
    }
}

function handleWrongAnswer() {
    playWrongSound();
    if (!answered) {
        answered = true;
        total++;
    }

    if (mode === 'audio-to-pinyin') {
        feedback.textContent = `✗ Wrong. The answer is: ${currentQuestion.pinyin} (${currentQuestion.char})`;
    } else {
        feedback.textContent = `✗ Wrong. The answer is: ${currentQuestion.pinyin}`;
    }
    feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-red-600';
    hint.textContent = `Meaning: ${currentQuestion.meaning}`;
    hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px] text-red-600';

    updateStats();

    // Clear input and refocus for retry
    setTimeout(() => {
        answerInput.value = '';
        answerInput.focus();
    }, 0);
}

// =============================================================================
// MULTIPLE CHOICE FUNCTIONS
// =============================================================================

function generatePinyinOptions() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    const currentPinyin = currentQuestion.pinyin.split('/')[0].trim();
    const wrongOptions = [];

    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * characters.length)];
        const randomPinyin = random.pinyin.split('/')[0].trim();
        if (random.char !== currentQuestion.char && !wrongOptions.includes(randomPinyin)) {
            wrongOptions.push(randomPinyin);
        }
    }

    const allOptions = [...wrongOptions, currentPinyin];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-4 text-xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
        btn.onclick = () => checkMultipleChoice(option);
        options.appendChild(btn);
    });
}

function generateCharOptions() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    const wrongOptions = [];
    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * characters.length)];
        if (random.char !== currentQuestion.char && !wrongOptions.includes(random.char)) {
            wrongOptions.push(random.char);
        }
    }

    const allOptions = [...wrongOptions, currentQuestion.char];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-8 text-6xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
        btn.onclick = () => checkMultipleChoice(option);
        options.appendChild(btn);
    });
}

function generateMeaningOptions() {
    const options = document.getElementById('options');
    if (!options) return;
    options.innerHTML = '';

    const wrongOptions = [];
    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * characters.length)];
        if (random.char !== currentQuestion.char && !wrongOptions.includes(random.meaning)) {
            wrongOptions.push(random.meaning);
        }
    }

    const allOptions = [...wrongOptions, currentQuestion.meaning];
    allOptions.sort(() => Math.random() - 0.5);

    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'px-6 py-4 text-xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition';
        btn.textContent = option;
        btn.onclick = () => checkMultipleChoice(option);
        options.appendChild(btn);
    });
}

function checkMultipleChoice(answer) {
    if (answered) return;

    answered = true;
    total++;

    let correct = false;
    let correctAnswer = '';

    if (mode === 'char-to-pinyin-mc') {
        const pinyinOptions = currentQuestion.pinyin.split('/').map(p => p.trim());
        correct = pinyinOptions.includes(answer);
        correctAnswer = currentQuestion.pinyin;
    } else if (mode === 'char-to-meaning') {
        correct = answer === currentQuestion.meaning;
        correctAnswer = currentQuestion.meaning;
    } else if (mode === 'pinyin-to-char' || mode === 'meaning-to-char') {
        correct = answer === currentQuestion.char;
        correctAnswer = currentQuestion.char;
    }

    if (correct) {
        score++;
        playCorrectSound();
        feedback.textContent = `✓ Correct!`;
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-green-600';
        hint.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
        hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px] text-green-600';

        setTimeout(() => generateQuestion(), 800);
    } else {
        playWrongSound();
        feedback.textContent = `✗ Wrong. The answer is: ${correctAnswer}`;
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-red-600';
        hint.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
        hint.className = 'text-center text-2xl font-semibold my-4 min-h-[20px] text-red-600';

        setTimeout(() => generateQuestion(), 1500);
    }

    updateStats();
}

function updateStats() {
    const scoreEl = document.getElementById('score');
    const totalEl = document.getElementById('total');
    const percentageEl = document.getElementById('percentage');
    const accuracyEl = document.getElementById('accuracy');

    if (scoreEl) scoreEl.textContent = score;
    if (totalEl) totalEl.textContent = total;

    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    if (percentageEl) percentageEl.textContent = percentage;
    if (accuracyEl) accuracyEl.textContent = percentage + '%';
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function initQuiz(charactersData, userConfig = {}) {
    quizCharacters = charactersData;
    config = userConfig;

    // Get DOM elements
    questionDisplay = document.getElementById('questionDisplay');
    answerInput = document.getElementById('answerInput');
    checkBtn = document.getElementById('checkBtn');
    feedback = document.getElementById('feedback');
    hint = document.getElementById('hint');
    typeMode = document.getElementById('typeMode');
    choiceMode = document.getElementById('choiceMode');
    strokeOrderMode = document.getElementById('strokeOrderMode');
    handwritingMode = document.getElementById('handwritingMode');
    drawCharMode = document.getElementById('drawCharMode');
    audioSection = document.getElementById('audioSection');

    // Setup event listeners
    checkBtn.addEventListener('click', checkAnswer);

    answerInput.addEventListener('input', () => {
        updatePartialProgress();
    });

    answerInput.addEventListener('keydown', (e) => {
        if (e.key === ' ' && mode === 'audio-to-pinyin' && audioSection) {
            e.preventDefault();
            if (window.currentAudioPlayFunc) {
                window.currentAudioPlayFunc();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            checkAnswer();
        }
    });

    // Mode selector
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mode = btn.dataset.mode;
            score = 0;
            total = 0;
            updateStats();
            generateQuestion();
        });
    });

    // Start first question
    generateQuestion();
}
