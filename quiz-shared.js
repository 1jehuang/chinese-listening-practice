// Shared quiz functionality for all character sheets

class ChineseQuiz {
    constructor(characters) {
        this.characters = characters;
        this.currentQuestion = null;
        this.score = 0;
        this.total = 0;
        this.answered = false;
        this.mode = 'char-to-pinyin';
        this.selectedOptionIndex = 0;
        this.writer = null;

        // Canvas drawing variables
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.strokes = [];
        this.currentStroke = [];
        this.ocrTimeout = null;

        // DOM elements
        this.questionDisplay = document.getElementById('questionDisplay');
        this.answerInput = document.getElementById('answerInput');
        this.checkBtn = document.getElementById('checkBtn');
        this.typeMode = document.getElementById('typeMode');
        this.choiceMode = document.getElementById('choiceMode');
        this.strokeOrderMode = document.getElementById('strokeOrderMode');
        this.handwritingMode = document.getElementById('handwritingMode');
        this.drawCharMode = document.getElementById('drawCharMode');
        this.feedback = document.getElementById('feedback');
        this.hint = document.getElementById('hint');
        this.nextBtn = document.getElementById('nextBtn');

        this.init();
    }

    init() {
        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
                this.generateQuestion();
            });
        });

        // Check button
        this.checkBtn.addEventListener('click', () => this.checkAnswer());

        // Enter key
        this.answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkAnswer();
        });

        // Next button
        this.nextBtn.addEventListener('click', () => {
            if (this.answered) this.generateQuestion();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.mode.includes('-mc') || this.mode === 'pinyin-to-char' || this.mode === 'meaning-to-char' || this.mode === 'char-to-meaning') {
                const buttons = document.querySelectorAll('.option-btn');

                if (e.key === 'ArrowDown' || e.key === 'j') {
                    e.preventDefault();
                    this.selectedOptionIndex = (this.selectedOptionIndex + 1) % buttons.length;
                    this.highlightOption();
                } else if (e.key === 'ArrowUp' || e.key === 'k') {
                    e.preventDefault();
                    this.selectedOptionIndex = (this.selectedOptionIndex - 1 + buttons.length) % buttons.length;
                    this.highlightOption();
                } else if (e.key === 'Enter' && buttons.length > 0) {
                    e.preventDefault();
                    buttons[this.selectedOptionIndex].click();
                }
            }

            if (e.key === 'ArrowRight' || e.key === 'l') {
                if (this.answered) {
                    e.preventDefault();
                    this.generateQuestion();
                }
            }
        });

        // Handwriting mode
        document.getElementById('revealBtn').addEventListener('click', () => {
            document.getElementById('answerReveal').style.display = 'block';
            document.getElementById('revealBtn').style.display = 'none';

            const answerWriterEl = document.getElementById('answerWriter');
            answerWriterEl.innerHTML = '';

            const answerWriter = HanziWriter.create(answerWriterEl, this.currentQuestion.char, {
                width: 300,
                height: 300,
                padding: 5,
                strokeAnimationSpeed: 2,
                delayBetweenStrokes: 100
            });

            answerWriter.animateCharacter();

            document.getElementById('answerPinyin').textContent = this.currentQuestion.pinyin;
            document.getElementById('answerMeaning').textContent = this.currentQuestion.meaning;

            setTimeout(() => this.generateQuestion(), 3000);
        });

        // Draw character mode
        document.getElementById('clearCanvas').addEventListener('click', () => this.clearCanvas());
        document.getElementById('checkDrawing').addEventListener('click', () => this.checkDrawing());
    }

    generateQuestion() {
        this.currentQuestion = this.characters[Math.floor(Math.random() * this.characters.length)];
        this.answered = false;
        this.feedback.textContent = '';
        this.feedback.className = 'feedback';
        this.hint.textContent = '';
        this.answerInput.value = '';

        // Hide all modes
        this.typeMode.style.display = 'none';
        this.choiceMode.style.display = 'none';
        this.strokeOrderMode.style.display = 'none';
        this.handwritingMode.style.display = 'none';
        this.drawCharMode.style.display = 'none';

        if (this.mode === 'char-to-pinyin') {
            this.questionDisplay.innerHTML = `<div class="character-display">${this.currentQuestion.char}</div><div style="text-align: center; color: #999; font-size: 14px; margin-top: -20px;">Type with tone marks (mǎ) or numbers (ma3)</div>`;
            this.answerInput.placeholder = 'e.g., mǎ or ma3';
            this.typeMode.style.display = 'block';
            setTimeout(() => this.answerInput.focus(), 100);
        } else if (this.mode === 'char-to-pinyin-mc') {
            this.questionDisplay.innerHTML = `<div class="character-display">${this.currentQuestion.char}</div>`;
            this.generatePinyinOptions();
            this.choiceMode.style.display = 'block';
        } else if (this.mode === 'pinyin-to-char') {
            this.questionDisplay.innerHTML = `<div style="text-align: center; font-size: 48px; margin: 40px 0;">${this.currentQuestion.pinyin}</div>`;
            this.generateCharOptions();
            this.choiceMode.style.display = 'block';
        } else if (this.mode === 'char-to-meaning') {
            this.questionDisplay.innerHTML = `<div class="character-display">${this.currentQuestion.char}</div>`;
            this.generateMeaningOptions();
            this.choiceMode.style.display = 'block';
        } else if (this.mode === 'stroke-order') {
            this.questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 20px 0;">${this.currentQuestion.pinyin} - ${this.currentQuestion.meaning}</div>`;
            this.strokeOrderMode.style.display = 'block';
            document.getElementById('strokeFeedback').textContent = '';
            this.initHanziWriter(this.currentQuestion.char);
        } else if (this.mode === 'handwriting') {
            this.questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 20px 0;">${this.currentQuestion.pinyin} - ${this.currentQuestion.meaning}</div>`;
            this.handwritingMode.style.display = 'block';
            document.getElementById('answerReveal').style.display = 'none';
            document.getElementById('revealBtn').style.display = 'inline-block';
        } else if (this.mode === 'meaning-to-char') {
            this.questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 40px 0;">${this.currentQuestion.meaning}</div>`;
            this.generateCharOptions();
            this.choiceMode.style.display = 'block';
        } else if (this.mode === 'draw-char') {
            this.questionDisplay.innerHTML = `<div style="text-align: center; font-size: 36px; margin: 20px 0;">${this.currentQuestion.pinyin} - ${this.currentQuestion.meaning}</div>`;
            this.drawCharMode.style.display = 'block';
            document.getElementById('drawFeedback').textContent = '';
            document.getElementById('ocrResult').textContent = '';
            this.initCanvas();
            this.clearCanvas();
        }
    }

    // Continue in next part...
    generatePinyinOptions() {
        const options = document.getElementById('options');
        options.innerHTML = '';

        const wrongOptions = [];
        while (wrongOptions.length < 3) {
            const random = this.characters[Math.floor(Math.random() * this.characters.length)];
            if (random.char !== this.currentQuestion.char && !wrongOptions.includes(random.pinyin)) {
                wrongOptions.push(random.pinyin);
            }
        }

        const allOptions = [...wrongOptions, this.currentQuestion.pinyin];
        allOptions.sort(() => Math.random() - 0.5);

        allOptions.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.onclick = () => this.checkMultipleChoice(option);
            options.appendChild(btn);
        });

        this.selectedOptionIndex = 0;
        this.highlightOption();
    }

    generateMeaningOptions() {
        const options = document.getElementById('options');
        options.innerHTML = '';

        const wrongOptions = [];
        while (wrongOptions.length < 3) {
            const random = this.characters[Math.floor(Math.random() * this.characters.length)];
            if (random.char !== this.currentQuestion.char && !wrongOptions.includes(random.meaning)) {
                wrongOptions.push(random.meaning);
            }
        }

        const allOptions = [...wrongOptions, this.currentQuestion.meaning];
        allOptions.sort(() => Math.random() - 0.5);

        allOptions.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.onclick = () => this.checkMultipleChoice(option);
            options.appendChild(btn);
        });

        this.selectedOptionIndex = 0;
        this.highlightOption();
    }

    generateCharOptions() {
        const options = document.getElementById('options');
        options.innerHTML = '';

        const wrongOptions = [];
        while (wrongOptions.length < 3) {
            const random = this.characters[Math.floor(Math.random() * this.characters.length)];
            if (random.char !== this.currentQuestion.char && !wrongOptions.includes(random.char)) {
                wrongOptions.push(random.char);
            }
        }

        const allOptions = [...wrongOptions, this.currentQuestion.char];
        allOptions.sort(() => Math.random() - 0.5);

        allOptions.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.onclick = () => this.checkMultipleChoice(option);
            options.appendChild(btn);
        });

        this.selectedOptionIndex = 0;
        this.highlightOption();
    }

    highlightOption() {
        const buttons = document.querySelectorAll('.option-btn');
        buttons.forEach((btn, i) => {
            btn.style.background = i === this.selectedOptionIndex ? '#e7f3ff' : 'white';
            btn.style.borderColor = i === this.selectedOptionIndex ? '#007bff' : '#ddd';
        });
    }

    normalizePinyin(input) {
        const toneMap = {
            'ā': 'a1', 'á': 'a2', 'ǎ': 'a3', 'à': 'a4',
            'ē': 'e1', 'é': 'e2', 'ě': 'e3', 'è': 'e4',
            'ī': 'i1', 'í': 'i2', 'ǐ': 'i3', 'ì': 'i4',
            'ō': 'o1', 'ó': 'o2', 'ǒ': 'o3', 'ò': 'o4',
            'ū': 'u1', 'ú': 'u2', 'ǔ': 'u3', 'ù': 'u4',
            'ǖ': 'v1', 'ǘ': 'v2', 'ǚ': 'v3', 'ǜ': 'v4',
            'ü': 'v'
        };

        let normalized = input.toLowerCase().trim();
        for (let [mark, number] of Object.entries(toneMap)) {
            normalized = normalized.replace(new RegExp(mark, 'g'), number);
        }
        return normalized;
    }

    checkAnswer() {
        if (this.answered) return;

        const userAnswer = this.answerInput.value.trim();
        if (!userAnswer) return;

        const normalizedUser = this.normalizePinyin(userAnswer);
        const normalizedCorrect = this.normalizePinyin(this.currentQuestion.pinyin);

        this.answered = true;
        this.total++;

        if (normalizedUser === normalizedCorrect) {
            this.score++;
            this.feedback.textContent = `✓ Correct! ${this.currentQuestion.char} is ${this.currentQuestion.pinyin}`;
            this.feedback.className = 'feedback correct';
            this.hint.textContent = `Meaning: ${this.currentQuestion.meaning}`;
            this.hint.style.color = '#28a745';
        } else {
            this.feedback.textContent = `✗ Wrong. The answer is: ${this.currentQuestion.pinyin}`;
            this.feedback.className = 'feedback incorrect';
            this.hint.textContent = `${this.currentQuestion.char} - ${this.currentQuestion.meaning}`;
            this.hint.style.color = '#dc3545';
        }

        this.updateStats();
        setTimeout(() => this.generateQuestion(), 1500);
    }

    checkMultipleChoice(answer) {
        if (this.answered) return;

        let correct = false;
        if (this.mode === 'char-to-pinyin-mc') {
            correct = answer === this.currentQuestion.pinyin;
        } else if (this.mode === 'char-to-meaning') {
            correct = answer === this.currentQuestion.meaning;
        } else if (this.mode === 'pinyin-to-char' || this.mode === 'meaning-to-char') {
            correct = answer === this.currentQuestion.char;
        }

        this.answered = true;
        this.total++;

        const buttons = document.querySelectorAll('.option-btn');

        if (correct) {
            this.score++;
            this.feedback.textContent = `✓ Correct!`;
            this.feedback.className = 'feedback correct';

            // Show pinyin hint for meaning-to-char and char-to-meaning modes
            if (this.mode === 'meaning-to-char' || this.mode === 'char-to-meaning') {
                this.hint.textContent = `${this.currentQuestion.char} (${this.currentQuestion.pinyin})`;
                this.hint.style.color = '#28a745';
            }

            buttons.forEach(btn => {
                if ((this.mode === 'char-to-pinyin-mc' && btn.textContent === this.currentQuestion.pinyin) ||
                    (this.mode === 'char-to-meaning' && btn.textContent === this.currentQuestion.meaning) ||
                    (this.mode === 'pinyin-to-char' && btn.textContent === this.currentQuestion.char) ||
                    (this.mode === 'meaning-to-char' && btn.textContent === this.currentQuestion.char)) {
                    btn.classList.add('correct');
                }
            });

            setTimeout(() => this.generateQuestion(), 800);
        } else {
            if (this.mode === 'char-to-pinyin-mc') {
                this.feedback.textContent = `✗ Wrong. The answer is: ${this.currentQuestion.pinyin}`;
                this.hint.textContent = `${this.currentQuestion.char} - ${this.currentQuestion.meaning}`;
            } else if (this.mode === 'char-to-meaning') {
                this.feedback.textContent = `✗ Wrong. The answer is: ${this.currentQuestion.meaning}`;
                this.hint.textContent = `${this.currentQuestion.char} (${this.currentQuestion.pinyin})`;
            } else if (this.mode === 'pinyin-to-char') {
                this.feedback.textContent = `✗ Wrong. The answer is: ${this.currentQuestion.char}`;
                this.hint.textContent = `${this.currentQuestion.pinyin} - ${this.currentQuestion.meaning}`;
            } else {
                this.feedback.textContent = `✗ Wrong. The answer is: ${this.currentQuestion.char}`;
                this.hint.textContent = `${this.currentQuestion.pinyin} - ${this.currentQuestion.meaning}`;
            }
            this.feedback.className = 'feedback incorrect';

            buttons.forEach(btn => {
                if (btn.textContent === answer) {
                    btn.classList.add('incorrect');
                } else if ((this.mode === 'char-to-pinyin-mc' && btn.textContent === this.currentQuestion.pinyin) ||
                          (this.mode === 'char-to-meaning' && btn.textContent === this.currentQuestion.meaning) ||
                          (this.mode === 'pinyin-to-char' && btn.textContent === this.currentQuestion.char) ||
                          (this.mode === 'meaning-to-char' && btn.textContent === this.currentQuestion.char)) {
                    btn.classList.add('correct');
                }
            });

            setTimeout(() => this.generateQuestion(), 2000);
        }

        this.updateStats();
    }

    updateStats() {
        const accuracy = this.total > 0 ? Math.round((this.score / this.total) * 100) : 0;
        document.querySelector('.stats').innerHTML = `Score: ${this.score}/${this.total} (${accuracy}%)`;
    }

    // Stroke order mode
    initHanziWriter(char) {
        if (this.writer) {
            this.writer = null;
        }

        const target = document.getElementById('hanziWriter');
        target.innerHTML = '';

        this.writer = HanziWriter.create(target, char, {
            width: 300,
            height: 300,
            padding: 5,
            showOutline: true,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 50
        });

        this.startHandwritingQuiz();
    }

    startHandwritingQuiz() {
        if (!this.writer) return;

        document.getElementById('strokeFeedback').textContent = 'Draw the character!';
        document.getElementById('strokeFeedback').style.color = '#007bff';

        let quizStartTime = Date.now();

        this.writer.quiz({
            onMistake: (strokeData) => {
                document.getElementById('strokeFeedback').textContent = '✗ Wrong stroke! Try again.';
                document.getElementById('strokeFeedback').style.color = '#dc3545';
            },
            onCorrectStroke: (strokeData) => {
                const current = strokeData.strokeNum + 1;
                const total = strokeData.strokesRemaining + current;
                document.getElementById('strokeFeedback').textContent = `✓ Correct! ${current}/${total} strokes`;
                document.getElementById('strokeFeedback').style.color = '#28a745';
            },
            onComplete: (summaryData) => {
                if (!this.answered) {
                    this.answered = true;
                    this.total++;
                    this.score++;

                    this.feedback.textContent = `✓ Perfect! ${this.currentQuestion.char} (${this.currentQuestion.pinyin})`;
                    this.feedback.className = 'feedback correct';
                    this.hint.textContent = `Meaning: ${this.currentQuestion.meaning}`;
                    this.hint.style.color = '#28a745';

                    const timeElapsed = Date.now() - quizStartTime;
                    const timeInSeconds = (timeElapsed / 1000).toFixed(1);
                    document.getElementById('strokeFeedback').textContent = `Completed in ${timeInSeconds}s!`;
                    document.getElementById('strokeFeedback').style.color = '#28a745';

                    this.updateStats();

                    setTimeout(() => this.generateQuestion(), 1500);
                }
            }
        });
    }

    // Draw character mode with OCR
    async initCanvas() {
        if (!this.canvas) {
            this.canvas = document.getElementById('drawCanvas');
            this.ctx = this.canvas.getContext('2d');

            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseout', () => this.stopDrawing());

            this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
            this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
            this.canvas.addEventListener('touchend', () => this.stopDrawing());
        }

        this.ctx.lineWidth = 8;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#000';

        this.strokes = [];
    }

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        if (e.touches && e.touches[0]) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCanvasCoords(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        this.currentStroke = [[coords.x, coords.y]];
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.startDrawing(e);
    }

    draw(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        const coords = this.getCanvasCoords(e);
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();

        this.currentStroke.push([coords.x, coords.y]);

        this.lastX = coords.x;
        this.lastY = coords.y;
    }

    handleTouchMove(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        this.draw(e);
    }

    stopDrawing() {
        if (this.isDrawing && this.currentStroke.length > 0) {
            this.strokes.push(this.currentStroke);
            this.currentStroke = [];

            if (this.ocrTimeout) clearTimeout(this.ocrTimeout);
            this.ocrTimeout = setTimeout(() => this.runOCR(), 500);
        }
        this.isDrawing = false;
    }

    clearCanvas() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.strokes = [];
        document.getElementById('ocrResult').textContent = '';
    }

    async runOCR() {
        if (this.strokes.length === 0) return;

        try {
            const data = {
                options: 'enable_pre_space',
                requests: [{
                    writing_guide: {
                        writing_area_width: this.canvas.width,
                        writing_area_height: this.canvas.height
                    },
                    ink: this.strokes,
                    language: 'zh_CN'
                }]
            };

            const response = await fetch('https://www.google.com.tw/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result && result[1] && result[1][0] && result[1][0][1]) {
                const topResult = result[1][0][1][0];
                document.getElementById('ocrResult').textContent = topResult;
            }
        } catch (error) {
            console.error('OCR error:', error);
        }
    }

    async checkDrawing() {
        if (!this.ctx || this.answered) return;

        const pixels = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        let hasDrawing = false;
        for (let i = 3; i < pixels.data.length; i += 4) {
            if (pixels.data[i] > 0) {
                hasDrawing = true;
                break;
            }
        }

        if (!hasDrawing) {
            document.getElementById('drawFeedback').textContent = 'Please draw something first!';
            document.getElementById('drawFeedback').style.color = '#dc3545';
            return;
        }

        const recognizedText = document.getElementById('ocrResult').textContent.trim();
        const correct = recognizedText.includes(this.currentQuestion.char);

        this.answered = true;
        this.total++;

        if (correct) {
            this.score++;
            this.feedback.textContent = `✓ Correct! You drew ${this.currentQuestion.char} (${this.currentQuestion.pinyin})`;
            this.feedback.className = 'feedback correct';
            this.hint.textContent = `Meaning: ${this.currentQuestion.meaning}`;
            this.hint.style.color = '#28a745';
            document.getElementById('drawFeedback').textContent = '✓ Correct!';
            document.getElementById('drawFeedback').style.color = '#28a745';
        } else {
            this.feedback.textContent = `✗ Wrong. You drew: ${recognizedText || '(nothing recognized)'}. The answer was: ${this.currentQuestion.char}`;
            this.feedback.className = 'feedback incorrect';
            this.hint.textContent = `${this.currentQuestion.char} (${this.currentQuestion.pinyin}) - ${this.currentQuestion.meaning}`;
            this.hint.style.color = '#dc3545';
            document.getElementById('drawFeedback').textContent = '✗ Try again!';
            document.getElementById('drawFeedback').style.color = '#dc3545';
        }

        this.updateStats();

        setTimeout(() => this.generateQuestion(), 2000);
    }
}
