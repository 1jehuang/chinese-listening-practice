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
