document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    const state = {
        countries: [],     // All available country data
        quizQueue: [],     // Countries selected for the current game
        currentQuestionIndex: 0,
        score: 0,
        isAnswering: false, // Lock to prevent double clicking
        totalQuestions: 10,
        difficulty: 'normal', // easy, normal, hard, all
        mode: 'name' // name (find country name), flag (find flag)
    };

    // --- Country Categorization ---
    // CCAs for "Easy" countries (Popular ones for kids/beginners)
    const EASY_COUNTRIES = [
        'JPN', 'USA', 'GBR', 'FRA', 'DEU', 'ITA', 'CAN', 'CHN', 'KOR', 'RUS',
        'AUS', 'BRA', 'IND', 'ESP', 'MEX', 'EGY', 'GRC', 'TUR', 'ARG', 'CHE',
        'SWE', 'NLD', 'BEL', 'SGP', 'THA', 'VNM', 'IDN', 'PHL', 'MYS', 'SAU',
        'ARE', 'SUI', 'NZL', 'DNK', 'FIN', 'NOR', 'PRT', 'AUT'
    ];

    // --- DOM Elements ---
    const screens = {
        start: document.getElementById('start-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen')
    };

    const elements = {
        modeBtns: document.querySelectorAll('.mode-btn'), // New
        diffBtns: document.querySelectorAll('.diff-btn'), // New
        restartBtn: document.getElementById('restart-btn'),
        scoreVal: document.getElementById('score-value'),
        currentQ: document.getElementById('current-question'),
        totalQ: document.getElementById('total-questions'),
        flagImg: document.getElementById('flag-image'),
        flagLoader: document.getElementById('flag-loader'),
        optionsContainer: document.getElementById('options-container'),
        finalScore: document.getElementById('final-score'),
        resultMsg: document.getElementById('result-message'),
        resetBtn: document.getElementById('reset-btn'),
        quizPanel: document.querySelector('.quiz-panel')
    };

    // --- API & Initialization ---

    const initGame = async (difficulty = 'normal') => {
        try {
            state.difficulty = difficulty;
            // Fetch data if not already loaded
            if (state.countries.length === 0) {
                // Fetch fields needed for categorization
                const response = await fetch('https://restcountries.com/v3.1/all?fields=flags,name,translations,cca3,independent,unMember');
                if (!response.ok) throw new Error('API Error');
                state.countries = await response.json();
            }

            // Reset State
            state.score = 0;
            state.currentQuestionIndex = 0;
            elements.scoreVal.textContent = '0';
            elements.currentQ.textContent = '1';
            elements.totalQ.textContent = state.totalQuestions;

            // Prepare Questions
            prepareQuestions();

            // Switch Screen
            switchScreen('quiz');

            // Show first question
            showQuestion();

        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('国データの取得に失敗しました。インターネット接続を確認して再読み込みしてください。');
        }
    };

    const prepareQuestions = () => {
        let pool = [];

        switch (state.difficulty) {
            case 'easy':
                pool = state.countries.filter(c => EASY_COUNTRIES.includes(c.cca3));
                break;
            case 'normal':
                // Sovereign states that are UN members
                pool = state.countries.filter(c => c.unMember);
                break;
            case 'hard':
                // Smaller nations or territories (not UN members)
                pool = state.countries.filter(c => !c.unMember);
                break;
            case 'all':
            default:
                pool = state.countries;
                break;
        }

        // Shuffle and pick
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        state.quizQueue = shuffled.slice(0, Math.min(state.totalQuestions, pool.length));
    };

    // --- Audio Controller ---
    const sounds = {
        correct: new Audio('Quiz-Ding_Dong03-2(Mid).mp3'),
        wrong: new Audio('Quiz-Buzzer02-5(Multi).mp3')
    };

    const playCorrectSound = () => {
        sounds.correct.currentTime = 0;
        sounds.correct.play().catch(e => console.log('Audio play blocked:', e));
    };

    const playWrongSound = () => {
        sounds.wrong.currentTime = 0;
        sounds.wrong.play().catch(e => console.log('Audio play blocked:', e));
    };

    // --- Core Game Logic ---

    const showQuestion = () => {
        state.isAnswering = false; // Unlock inputs
        const targetCountry = state.quizQueue[state.currentQuestionIndex];
        const jpnName = targetCountry.translations?.jpn?.common || targetCountry.name.common;

        // Update UI
        elements.currentQ.textContent = state.currentQuestionIndex + 1;

        if (state.mode === 'name') {
            // Mode: Name Quiz (Flag -> Names)
            elements.quizPanel.classList.add('mode-name');
            elements.quizPanel.classList.remove('mode-flag');
            elements.flagImg.parentElement.style.display = 'flex';
            elements.questionText = document.querySelector('.question-text');
            elements.questionText.textContent = "この国旗はどこの国？";

            // Load Flag
            elements.flagImg.classList.add('hidden');
            elements.flagLoader.style.display = 'block';
            elements.flagImg.onload = () => {
                elements.flagLoader.style.display = 'none';
                elements.flagImg.classList.remove('hidden');
            };
            elements.flagImg.src = targetCountry.flags.svg;

        } else {
            // Mode: Flag Quiz (Name -> Flags)
            elements.quizPanel.classList.add('mode-flag');
            elements.quizPanel.classList.remove('mode-name');
            elements.flagImg.parentElement.style.display = 'none';
            elements.questionText = document.querySelector('.question-text');
            elements.questionText.innerHTML = `<span style="color:var(--accent-glow); font-size: 1.5rem; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${jpnName}</span> の国旗はどれ？`;
        }

        // Generate Options (1 correct + 3 wrong)
        const wrongOptions = getWrongOptions(targetCountry, 3);
        const options = shuffleArray([targetCountry, ...wrongOptions]);

        // Render Buttons
        elements.optionsContainer.innerHTML = '';
        options.forEach((country, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';

            // Create Number Badge
            const numBadge = document.createElement('span');
            numBadge.className = 'option-number';
            numBadge.textContent = idx + 1;
            btn.appendChild(numBadge);

            if (state.mode === 'name') {
                const labelContainer = document.createElement('span');
                labelContainer.className = 'option-label-text';
                const label = country.translations?.jpn?.common || country.name.common;
                labelContainer.textContent = label;
                btn.appendChild(labelContainer);

                // Adjust font size for long country names
                if (label.length > 10) btn.style.fontSize = '0.9rem';
                if (label.length > 20) btn.style.fontSize = '0.75rem';
            } else {
                // Show flag inside button
                const img = document.createElement('img');
                img.src = country.flags.svg;
                img.className = 'option-flag';
                btn.appendChild(img);
            }

            btn.setAttribute('data-cca3', country.cca3);
            btn.onclick = () => handleAnswer(country, targetCountry, btn);
            elements.optionsContainer.appendChild(btn);
        });
    };

    const getWrongOptions = (correctCountry, count) => {
        const wrong = [];
        while (wrong.length < count) {
            const random = state.countries[Math.floor(Math.random() * state.countries.length)];
            // Ensure unique and not the correct answer
            if (random.cca3 !== correctCountry.cca3 && !wrong.find(w => w.cca3 === random.cca3)) {
                wrong.push(random);
            }
        }
        return wrong;
    };

    const handleAnswer = (selected, correct, btnElement) => {
        if (state.isAnswering) return;
        state.isAnswering = true;

        const isCorrect = selected.cca3 === correct.cca3;

        // Visual Feedback
        if (isCorrect) {
            btnElement.classList.add('correct');
            state.score++;
            elements.scoreVal.textContent = state.score;
            playCorrectSound();
        } else {
            btnElement.classList.add('incorrect');
            // Highlight the correct one
            const buttons = elements.optionsContainer.querySelectorAll('.option-btn');
            buttons.forEach(b => {
                if (b.getAttribute('data-cca3') === correct.cca3) {
                    b.classList.add('correct');
                }
            });
            playWrongSound();
        }

        // Wait before next question
        setTimeout(() => {
            nextQuestion();
        }, 1500);
    };

    const nextQuestion = () => {
        state.currentQuestionIndex++;
        if (state.currentQuestionIndex < state.totalQuestions) {
            showQuestion();
        } else {
            endGame();
        }
    };

    const endGame = () => {
        elements.finalScore.textContent = state.score;

        // Generate message based on score
        let msg = '';
        const ratio = state.score / state.totalQuestions;
        if (ratio === 1) msg = 'Perfect!! 素晴らしい！全問正解です！🏆';
        else if (ratio >= 0.8) msg = 'Great Job! 惜しい！あと少し！✨';
        else if (ratio >= 0.5) msg = 'Good! その調子！👍';
        else msg = 'Don\'t give up! 次は頑張ろう！💪';

        elements.resultMsg.textContent = msg;
        switchScreen('result');
    };

    // --- Helpers ---

    const switchScreen = (screenName) => {
        Object.values(screens).forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('active');
        });
        screens[screenName].classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => {
            screens[screenName].classList.add('active');
        }, 10);
    };

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    // --- Event Listeners ---
    elements.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.mode = btn.getAttribute('data-mode');
        });
    });

    elements.diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const diff = btn.getAttribute('data-difficulty');
            initGame(diff);
        });
    });

    elements.restartBtn.addEventListener('click', () => {
        initGame(state.difficulty);
    });

    elements.resetBtn.addEventListener('click', () => {
        if (confirm('タイトルに戻りますか？')) {
            switchScreen('start');
        }
    });
});
