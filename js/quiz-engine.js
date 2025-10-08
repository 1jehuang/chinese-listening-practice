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
let typeMode, choiceMode, fuzzyMode, fuzzyInput, strokeOrderMode, handwritingMode, drawCharMode, studyMode;
let audioSection;

// Hanzi Writer
let writer = null;

// Canvas drawing variables
let canvas, ctx;
let isDrawing = false;
let lastX, lastY;
let strokes = [];
let currentStroke = [];
let ocrTimeout = null;

// =============================================================================
// PINYIN UTILITIES
// =============================================================================

function convertPinyinToToneNumbers(pinyin) {
    const toneMarkToBase = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
        'ü': 'v'
    };

    const toneMarkToNumber = {
        'ā': '1', 'á': '2', 'ǎ': '3', 'à': '4',
        'ē': '1', 'é': '2', 'ě': '3', 'è': '4',
        'ī': '1', 'í': '2', 'ǐ': '3', 'ì': '4',
        'ō': '1', 'ó': '2', 'ǒ': '3', 'ò': '4',
        'ū': '1', 'ú': '2', 'ǔ': '3', 'ù': '4',
        'ǖ': '1', 'ǘ': '2', 'ǚ': '3', 'ǜ': '4'
    };

    let text = pinyin.toLowerCase();
    let result = '';
    let i = 0;

    const isVowel = (c) => 'aeiouv'.includes(c);
    const isEndingConsonant = (c) => 'ngr'.includes(c); // Only n, g, r can end a syllable

    while (i < text.length) {
        const char = text[i];

        if (toneMarkToNumber[char]) {
            const toneNum = toneMarkToNumber[char];
            const baseVowel = toneMarkToBase[char];
            result += baseVowel;

            // After tone-marked vowel, collect: more vowels OR ending consonants (n/g/r)
            let j = i + 1;
            while (j < text.length && text[j] !== ' ' && text[j] !== '.' && !toneMarkToNumber[text[j]]) {
                const nextChar = text[j];
                if (isVowel(nextChar) || isEndingConsonant(nextChar)) {
                    result += nextChar;
                    j++;
                } else {
                    // Hit a non-ending consonant (starts new syllable)
                    break;
                }
            }

            result += toneNum;
            i = j;
        } else {
            result += char;
            i++;
        }
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

    // Handle multiple pronunciations (e.g., "cháng/zhǎng")
    if (correctLower.includes('/')) {
        const options = correctLower.split('/').map(o => o.trim());
        return options.some(option => checkPinyinMatch(user, option));
    }

    // Direct match with tone marks
    if (user === correctLower) return true;

    // Convert both to normalized forms for comparison
    const userNormalized = normalizePinyin(user);
    const correctNormalized = normalizePinyin(correctLower);

    // Debug logging (will be visible in browser console during tests)
    if (typeof console !== 'undefined' && console.log) {
        console.log(`checkPinyinMatch: "${user}" vs "${correctLower}"`);
        console.log(`  userNormalized: "${userNormalized}"`);
        console.log(`  correctNormalized: "${correctNormalized}"`);
        console.log(`  match: ${userNormalized === correctNormalized}`);
    }

    // Check if normalized forms match
    if (userNormalized === correctNormalized) return true;

    return false;
}

function normalizePinyin(pinyin) {
    // Normalize pinyin to a standard form for comparison
    // 1. Convert to lowercase
    // 2. Convert tone marks to tone numbers
    // 3. Remove all separators (spaces, dots)
    // 4. Result: "zhong1guo2" format

    let result = pinyin.toLowerCase().trim();

    // Convert tone marks to numbers
    result = convertPinyinToToneNumbers(result);

    // Remove all separators (spaces, dots, etc.)
    result = result.replace(/[\s.]+/g, '');

    return result;
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

    currentQuestion = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];

    // Hide all mode containers
    typeMode.style.display = 'none';
    if (choiceMode) choiceMode.style.display = 'none';
    if (fuzzyMode) fuzzyMode.style.display = 'none';
    if (strokeOrderMode) strokeOrderMode.style.display = 'none';
    if (handwritingMode) handwritingMode.style.display = 'none';
    if (drawCharMode) drawCharMode.style.display = 'none';
    if (studyMode) studyMode.style.display = 'none';
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
    } else if (mode === 'char-to-meaning-type' && fuzzyMode) {
        questionDisplay.innerHTML = `<div class="text-center text-8xl my-8 font-normal text-gray-800">${currentQuestion.char}</div>`;
        generateFuzzyMeaningOptions();
        fuzzyMode.style.display = 'block';
    } else if (mode === 'meaning-to-char' && choiceMode) {
        questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 40px 0;">${currentQuestion.meaning}</div>`;
        generateCharOptions();
        choiceMode.style.display = 'block';
    } else if (mode === 'stroke-order' && strokeOrderMode) {
        questionDisplay.innerHTML = `<div class="text-center text-6xl my-8 font-bold text-gray-700">Watch the stroke order:</div>`;
        strokeOrderMode.style.display = 'block';
        initStrokeOrder();
    } else if (mode === 'handwriting' && handwritingMode) {
        questionDisplay.innerHTML = `<div class="text-center text-6xl my-8 font-bold text-gray-700">Practice: ${currentQuestion.pinyin}</div>`;
        handwritingMode.style.display = 'block';
        initHandwriting();
    } else if (mode === 'draw-char' && drawCharMode) {
        questionDisplay.innerHTML = `<div class="text-center text-4xl my-8 font-bold text-gray-700">Draw: ${currentQuestion.pinyin}</div>`;
        drawCharMode.style.display = 'block';
        initCanvas();
        clearCanvas();
    } else if (mode === 'study' && studyMode) {
        questionDisplay.innerHTML = `<div class="text-center text-4xl my-8 font-bold text-gray-700">Study All Vocabulary</div>`;
        studyMode.style.display = 'block';
        populateStudyList();
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
        // More syllables needed - show progress without revealing remaining syllables
        hint.textContent = `✓ ${enteredSyllables.join(' ')} (${enteredSyllables.length}/${syllables.length})`;
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
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
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
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
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
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
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

function generateFuzzyMeaningOptions() {
    const options = document.getElementById('fuzzyOptions');
    if (!options || !fuzzyInput) return;

    options.innerHTML = '';
    fuzzyInput.value = '';

    const wrongOptions = [];
    while (wrongOptions.length < 3) {
        const random = quizCharacters[Math.floor(Math.random() * quizCharacters.length)];
        if (random.char !== currentQuestion.char && !wrongOptions.includes(random.meaning)) {
            wrongOptions.push(random.meaning);
        }
    }

    const allOptions = [...wrongOptions, currentQuestion.meaning];
    allOptions.sort(() => Math.random() - 0.5);

    let lastPlayedMatch = null; // Track last played audio to avoid repeats

    allOptions.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-gray-300 transition';
        btn.textContent = option;
        btn.dataset.index = index;
        btn.dataset.meaning = option;
        btn.onclick = () => checkFuzzyAnswer(option);
        options.appendChild(btn);
    });

    // Fuzzy matching on input
    fuzzyInput.oninput = () => {
        const input = fuzzyInput.value.trim().toLowerCase();
        if (!input) {
            document.querySelectorAll('#fuzzyOptions button').forEach(btn => {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            });
            return;
        }

        let bestMatch = null;
        let bestScore = -1;
        let bestMatchMeaning = null;

        allOptions.forEach((option, index) => {
            const score = fuzzyMatch(input, option.toLowerCase());
            if (score > bestScore) {
                bestScore = score;
                bestMatch = index;
                bestMatchMeaning = option;
            }
        });

        document.querySelectorAll('#fuzzyOptions button').forEach((btn, index) => {
            if (index === bestMatch) {
                btn.classList.remove('bg-gray-100', 'border-gray-300');
                btn.classList.add('bg-blue-200', 'border-blue-500');
            } else {
                btn.classList.remove('bg-blue-200', 'border-blue-500');
                btn.classList.add('bg-gray-100', 'border-gray-300');
            }
        });

        // Play audio for the character if best match is the correct answer (only once per match)
        if (bestMatchMeaning === currentQuestion.meaning && lastPlayedMatch !== currentQuestion.char) {
            lastPlayedMatch = currentQuestion.char;
            const firstPinyin = currentQuestion.pinyin.split('/').map(p => p.trim())[0];
            if (window.playPinyinAudio) {
                playPinyinAudio(firstPinyin, currentQuestion.char);
            }
        }
    };

    // Enter key to select highlighted option
    fuzzyInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const selected = document.querySelector('#fuzzyOptions button.bg-blue-200');
            if (selected) {
                selected.click();
            }
        }
    };

    fuzzyInput.focus();
}

function checkFuzzyAnswer(answer) {
    if (answered) return;
    answered = true;
    total++;

    const correct = answer === currentQuestion.meaning;

    // Play audio for the character
    const firstPinyin = currentQuestion.pinyin.split('/').map(p => p.trim())[0];
    if (window.playPinyinAudio) {
        playPinyinAudio(firstPinyin, currentQuestion.char);
    }

    if (correct) {
        playCorrectSound();
        score++;
        feedback.textContent = `✓ Correct! ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-green-600';
        updateStats();
        setTimeout(() => generateQuestion(), 1500);
    } else {
        playWrongSound();
        feedback.textContent = `✗ Wrong! Correct: ${currentQuestion.meaning} - ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-red-600';
        updateStats();
        setTimeout(() => {
            feedback.textContent = '';
            answered = false;
            fuzzyInput.value = '';
            fuzzyInput.focus();
        }, 1500);
    }
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
// SPECIAL MODES (Stroke Order, Handwriting, Draw, Study)
// =============================================================================

function initStrokeOrder() {
    const writerDiv = document.getElementById('strokeOrderWriter');
    if (!writerDiv || typeof HanziWriter === 'undefined') return;

    writerDiv.innerHTML = '';

    // Use first character for multi-character words
    const char = currentQuestion.char[0];

    writer = HanziWriter.create(writerDiv, char, {
        width: 300,
        height: 300,
        padding: 5,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 200
    });

    writer.animateCharacter({
        onComplete: () => {
            setTimeout(() => {
                generateQuestion();
            }, 1000);
        }
    });
}

function initHandwriting() {
    const writerDiv = document.getElementById('handwritingWriter');
    if (!writerDiv || typeof HanziWriter === 'undefined') return;

    writerDiv.innerHTML = '';

    // Use first character for multi-character words
    const char = currentQuestion.char[0];

    writer = HanziWriter.create(writerDiv, char, {
        width: 300,
        height: 300,
        padding: 5,
        showOutline: false,
        showCharacter: false,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 50
    });

    const hwShowBtn = document.getElementById('hwShowBtn');
    const hwNextBtn = document.getElementById('hwNextBtn');

    if (hwShowBtn) {
        hwShowBtn.onclick = () => {
            writer.showCharacter();
            writer.showOutline();
            writer.animateCharacter();

            feedback.textContent = `${currentQuestion.char} (${currentQuestion.pinyin}) - ${currentQuestion.meaning}`;
            feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-blue-600';
        };
    }

    if (hwNextBtn) {
        hwNextBtn.onclick = () => {
            generateQuestion();
        };
    }
}

function initCanvas() {
    canvas = document.getElementById('drawCanvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);

    strokes = [];

    const clearBtn = document.getElementById('clearCanvasBtn');
    const submitBtn = document.getElementById('submitDrawBtn');

    if (clearBtn) {
        clearBtn.onclick = clearCanvas;
    }

    if (submitBtn) {
        submitBtn.onclick = submitDrawing;
    }
}

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startDrawing(e) {
    isDrawing = true;
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;
    currentStroke = [[coords.x, coords.y]];
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    currentStroke.push([coords.x, coords.y]);
    lastX = coords.x;
    lastY = coords.y;
}

function stopDrawing() {
    if (isDrawing && currentStroke.length > 0) {
        strokes.push(currentStroke);
        currentStroke = [];

        if (ocrTimeout) clearTimeout(ocrTimeout);
        ocrTimeout = setTimeout(runOCR, 500);
    }
    isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    startDrawing(e);
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    draw(e);
}

async function runOCR() {
    if (strokes.length === 0) return;

    try {
        const data = {
            options: 'enable_pre_space',
            requests: [{
                writing_guide: {
                    writing_area_width: canvas.width,
                    writing_area_height: canvas.height
                },
                ink: strokes,
                language: 'zh_CN'
            }]
        };

        const response = await fetch('https://www.google.com.tw/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result[1] && result[1][0] && result[1][0][1]) {
            const recognizedChar = result[1][0][1][0];
            const ocrResult = document.getElementById('ocrResult');
            if (ocrResult) {
                ocrResult.textContent = recognizedChar;
            }
        }
    } catch (error) {
        console.error('OCR error:', error);
    }
}

function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    currentStroke = [];
    const ocrResult = document.getElementById('ocrResult');
    if (ocrResult) {
        ocrResult.textContent = '';
    }
}

function submitDrawing() {
    const ocrResult = document.getElementById('ocrResult');
    if (!ocrResult) return;

    const recognized = ocrResult.textContent.trim();
    if (!recognized) {
        feedback.textContent = '✗ Please draw a character first!';
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-red-600';
        return;
    }

    answered = true;
    total++;
    const correct = recognized === currentQuestion.char;

    if (correct) {
        playCorrectSound();
        score++;
        feedback.textContent = `✓ Correct! ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-green-600';
    } else {
        playWrongSound();
        feedback.textContent = `✗ Wrong! You wrote: ${recognized}, Correct: ${currentQuestion.char} (${currentQuestion.pinyin})`;
        feedback.className = 'text-center text-2xl font-semibold my-4 min-h-[24px] text-red-600';
    }

    updateStats();
    setTimeout(() => {
        clearCanvas();
        generateQuestion();
    }, 2000);
}

function populateStudyList() {
    const studyList = document.getElementById('studyList');
    if (!studyList) return;

    studyList.innerHTML = '';

    quizCharacters.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition';

        const firstPinyin = item.pinyin.split('/')[0].trim();
        div.innerHTML = `
            <button class="flex-shrink-0 w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition"
                    onclick="playPinyinAudio('${firstPinyin}', '${item.char}')">
                🔊
            </button>
            <div class="flex-grow grid grid-cols-3 gap-4 items-center">
                <div class="text-4xl font-bold">${item.char}</div>
                <div class="text-xl text-gray-700">${item.pinyin}</div>
                <div class="text-lg text-gray-600">${item.meaning}</div>
            </div>
        `;

        studyList.appendChild(div);
    });
}

// =============================================================================
// COMMAND PALETTE
// =============================================================================

function initCommandPalette() {
    // Create command palette HTML
    const paletteHTML = `
        <div id="commandPalette" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" style="display: none;">
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
                <input type="text" id="paletteSearch"
                       class="w-full px-6 py-4 text-lg border-b border-gray-200 focus:outline-none"
                       placeholder="Search modes and pages...">
                <div id="paletteResults" class="max-h-96 overflow-y-auto"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', paletteHTML);

    const palette = document.getElementById('commandPalette');
    const search = document.getElementById('paletteSearch');
    const results = document.getElementById('paletteResults');

    let selectedIndex = 0;

    const modes = [
        { name: 'Char → Pinyin', mode: 'char-to-pinyin', type: 'mode' },
        { name: 'Char → Pinyin (MC)', mode: 'char-to-pinyin-mc', type: 'mode' },
        { name: 'Audio → Pinyin', mode: 'audio-to-pinyin', type: 'mode' },
        { name: 'Pinyin → Char', mode: 'pinyin-to-char', type: 'mode' },
        { name: 'Char → Meaning', mode: 'char-to-meaning', type: 'mode' },
        { name: 'Char → Meaning (Fuzzy)', mode: 'char-to-meaning-type', type: 'mode' },
        { name: 'Meaning → Char', mode: 'meaning-to-char', type: 'mode' },
        { name: 'Stroke Order', mode: 'stroke-order', type: 'mode' },
        { name: 'Handwriting', mode: 'handwriting', type: 'mode' },
        { name: 'Draw Character', mode: 'draw-char', type: 'mode' },
        { name: 'Study Mode', mode: 'study', type: 'mode' }
    ];

    const pages = [
        { name: 'Home', url: 'home.html', type: 'page' },
        { name: 'Lesson 1: Two Maps', url: 'lesson-1-quiz.html', type: 'page' },
        { name: 'Test Modular Quiz', url: 'test-modular-quiz.html', type: 'page' }
    ];

    const allItems = [...modes, ...pages];

    function filterItems(query) {
        if (!query.trim()) return allItems;
        const lower = query.toLowerCase();
        return allItems.filter(item =>
            item.name.toLowerCase().includes(lower) ||
            (item.mode && item.mode.toLowerCase().includes(lower))
        );
    }

    function renderResults(items) {
        selectedIndex = 0;
        results.innerHTML = items.map((item, i) => `
            <div class="palette-item px-6 py-3 cursor-pointer hover:bg-blue-50 flex items-center justify-between ${i === 0 ? 'bg-blue-100' : ''}"
                 data-index="${i}">
                <div>
                    <div class="font-semibold">${item.name}</div>
                    <div class="text-sm text-gray-500">${item.type === 'mode' ? 'Quiz Mode' : 'Page'}</div>
                </div>
                <div class="text-sm text-gray-400">${item.type === 'mode' ? '→ Switch Mode' : '↗ Navigate'}</div>
            </div>
        `).join('');

        // Add click handlers
        results.querySelectorAll('.palette-item').forEach((el, i) => {
            el.addEventListener('click', () => selectItem(items[i]));
        });
    }

    function updateSelection(newIndex, items) {
        const itemEls = results.querySelectorAll('.palette-item');
        if (itemEls[selectedIndex]) {
            itemEls[selectedIndex].classList.remove('bg-blue-100');
        }
        selectedIndex = newIndex;
        if (itemEls[selectedIndex]) {
            itemEls[selectedIndex].classList.add('bg-blue-100');
            itemEls[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function selectItem(item) {
        if (item.type === 'mode') {
            const btn = document.querySelector(`[data-mode="${item.mode}"]`);
            if (btn) btn.click();
        } else if (item.type === 'page') {
            window.location.href = item.url;
        }
        closePalette();
    }

    function openPalette() {
        palette.style.display = 'flex';
        search.value = '';
        renderResults(allItems);
        setTimeout(() => search.focus(), 10);
    }

    function closePalette() {
        palette.style.display = 'none';
        search.value = '';
    }

    // Keyboard shortcut: Ctrl+K or Cmd+K
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (palette.style.display === 'none') {
                openPalette();
            } else {
                closePalette();
            }
        }
    });

    // Search input
    search.addEventListener('input', () => {
        const items = filterItems(search.value);
        renderResults(items);
    });

    // Arrow key navigation
    search.addEventListener('keydown', (e) => {
        const items = filterItems(search.value);
        const itemEls = results.querySelectorAll('.palette-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                updateSelection(selectedIndex + 1, items);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
                updateSelection(selectedIndex - 1, items);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[selectedIndex]) {
                selectItem(items[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePalette();
        }
    });

    // Close on background click
    palette.addEventListener('click', (e) => {
        if (e.target === palette) {
            closePalette();
        }
    });
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
    fuzzyMode = document.getElementById('fuzzyMode');
    fuzzyInput = document.getElementById('fuzzyInput');
    strokeOrderMode = document.getElementById('strokeOrderMode');
    handwritingMode = document.getElementById('handwritingMode');
    drawCharMode = document.getElementById('drawCharMode');
    studyMode = document.getElementById('studyMode');
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
            document.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500');
                b.classList.add('border-gray-300');
            });
            btn.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
            btn.classList.remove('border-gray-300');
            mode = btn.dataset.mode;
            score = 0;
            total = 0;
            updateStats();
            generateQuestion();
        });
    });

    // Set initial active button
    const initialBtn = document.querySelector(`[data-mode="${mode}"]`);
    if (initialBtn) {
        initialBtn.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
        initialBtn.classList.remove('border-gray-300');
    }

    // Initialize command palette
    initCommandPalette();

    // Start first question
    generateQuestion();
}
