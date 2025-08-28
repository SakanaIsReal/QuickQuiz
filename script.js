document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const jsonInput = document.getElementById('json-input');
    const importBtn = document.getElementById('import-btn');
    const jsonError = document.getElementById('json-error');
    const importPanel = document.getElementById('import-panel');
    const quizPanel = document.getElementById('quiz-panel');
    const resultsPanel = document.getElementById('results-panel');
    const quizTitle = document.getElementById('quiz-title');
    const quizContainer = document.getElementById('quiz-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const scoreValue = document.getElementById('score-value');
    const totalQuestions = document.getElementById('total-questions');
    const reviewContainer = document.getElementById('review-container');
    const restartBtn = document.getElementById('restart-btn');
    const timerToggle = document.getElementById('timer-toggle');
    const timerDisplay = document.getElementById('timer');
    const seedInput = document.getElementById('seed-input');
    const seedDisplay = document.getElementById('seed-display');
    const seedValueDisplay = document.getElementById('seed-value');
    const sidebar = document.getElementById('sidebar');
    const questionList = document.getElementById('question-list');
    const flagBtn = document.getElementById('flag-btn');
    const confirmationPanel = document.getElementById('confirmation-panel');
    const confirmationSummary = document.getElementById('confirmation-summary');
    const confirmSubmissionBtn = document.getElementById('confirm-submission-btn');
    const cancelSubmissionBtn = document.getElementById('cancel-submission-btn');
    const reviewAndSubmitBtn = document.getElementById('review-and-submit-btn');
    const themeSwitcher = document.getElementById('theme-switcher');

    // Quiz state
    let quizData = null;
    let randomizedQuestions = [];
    let userAnswers = [];
    let timerInterval = null;
    let secondsElapsed = 0;
    let currentAbsoluteIndex = 0;
    let currentSeed = null;

    // --- THEME SWITCHER LOGIC ---
    // Apply saved theme on load
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeSwitcher.checked = true;
    }

    themeSwitcher.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
    // --- END THEME SWITCHER LOGIC ---

    // Simple pseudo-random number generator (PRNG)
    const prng = (seed) => {
        let s = seed % 2147483647;
        if (s <= 0) s += 2147483646;
        return () => (s = (s * 16807) % 2147483647) / 2147483647;
    };

    // Fisher-Yates shuffle algorithm
    const shuffle = (array, random) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    };
    
    // Sample JSON for testing
    const sampleQuizJSON = `{
        "quizTitle": "Sample Quiz",
        "description": "This is a sample quiz to demonstrate the functionality",
        "sections": [
            {
                "sectionName": "Mathematics",
                "instructions": "Solve the following math problems",
                "questions": [
                    {
                        "id": 1,
                        "question": "What is 2 + 2?",
                        "options": ["3", "4", "5", "6"],
                        "correctAnswer": 1,
                        "explanation": "Basic addition gives us 4"
                    },
                    {
                        "id": 2,
                        "question": "What is 5 × 3?",
                        "options": ["10", "15", "20", "25"],
                        "correctAnswer": 1,
                        "explanation": "5 multiplied by 3 equals 15"
                    },
                    {
                        "id": 3,
                        "question": "What is the square root of 81?",
                        "options": ["7", "8", "9", "10"],
                        "correctAnswer": 2,
                        "explanation": "The square root of a number, x, is a number that, when multiplied by itself, equals x. Since 9 × 9 = 81, the square root of 81 is 9."
                    }
                ]
            },
            {
                "sectionName": "Science",
                "instructions": "Answer the science questions",
                "questions": [
                    {
                        "id": 4,
                        "question": "What is H₂O?",
                        "options": ["Oxygen", "Hydrogen", "Water", "Carbon Dioxide"],
                        "correctAnswer": 2,
                        "explanation": "H₂O is the chemical formula for water"
                    },
                    {
                        "id": 5,
                        "question": "What is the largest planet in our solar system?",
                        "options": ["Earth", "Mars", "Jupiter", "Saturn"],
                        "correctAnswer": 2,
                        "explanation": "Jupiter is the largest planet in the solar system, with a mass more than two and a half times that of all the other planets combined."
                    }
                ]
            }
        ]
    }`;
    
    // Preload sample JSON
    jsonInput.value = sampleQuizJSON;
    
    // Event listeners
    importBtn.addEventListener('click', importQuiz);
    prevBtn.addEventListener('click', showPreviousQuestion);
    nextBtn.addEventListener('click', showNextQuestion);
    submitBtn.addEventListener('click', showConfirmationPage);
    restartBtn.addEventListener('click', restartQuiz);
    timerToggle.addEventListener('change', toggleTimer);
    flagBtn.addEventListener('click', toggleFlag);
    confirmSubmissionBtn.addEventListener('click', submitQuiz);
    cancelSubmissionBtn.addEventListener('click', () => {
        confirmationPanel.classList.add('hidden');
        quizPanel.classList.remove('hidden');
        sidebar.classList.remove('hidden');
    });
    reviewAndSubmitBtn.addEventListener('click', showConfirmationPage);
    confirmationSummary.addEventListener('click', (event) => {
        const summaryItem = event.target.closest('.summary-item');
        if (summaryItem && summaryItem.dataset.questionIndex) {
            const questionIndex = parseInt(summaryItem.dataset.questionIndex, 10);
            
            confirmationPanel.classList.add('hidden');
            quizPanel.classList.remove('hidden');
            sidebar.classList.remove('hidden');

            goToQuestion(questionIndex);
        }
    });
    
    // Import quiz from JSON and start
    function importQuiz() {
        try {
            const json = jsonInput.value.trim();
            if (!json) {
                throw new Error('Please enter JSON data');
            }
            
            quizData = JSON.parse(json);
            
            // Validate quiz data structure
            if (!quizData.quizTitle || !quizData.sections || !Array.isArray(quizData.sections)) {
                throw new Error('Invalid quiz format. Please check the JSON structure.');
            }
            
            // Collect all questions into a single array
            let allQuestions = [];
            quizData.sections.forEach(section => {
                allQuestions = allQuestions.concat(section.questions.map(q => ({
                    ...q,
                    sectionName: section.sectionName,
                    sectionInstructions: section.instructions
                })));
            });
            
            // Handle seed for randomization
            const seed = seedInput.value.trim() || Date.now();
            const numericSeed = typeof seed === 'string' ? seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : seed;
            currentSeed = seed;
            const random = prng(numericSeed);
            
            // Shuffle the questions and their options
            randomizedQuestions = shuffle(allQuestions, random);
            randomizedQuestions.forEach(question => {
                shuffle(question.options, random);
            });

            // Update user answers
            userAnswers = randomizedQuestions.map(q => ({
                questionId: q.id,
                selectedOption: null,
                isCorrect: false,
                isFlagged: false,
                questionData: q
            }));
            
            // Reset quiz state
            currentAbsoluteIndex = 0;
            secondsElapsed = 0;
            timerDisplay.textContent = '00:00';
            
            // Update UI
            quizTitle.textContent = quizData.quizTitle;
            seedValueDisplay.textContent = currentSeed;
            seedDisplay.classList.remove('hidden');
            jsonError.classList.add('hidden');
            importPanel.classList.add('hidden');
            quizPanel.classList.remove('hidden');
            sidebar.classList.remove('hidden');

            // Create sidebar navigation
            createSidebarNavigation();
            
            // Load first question
            renderQuestion();
            
        } catch (error) {
            jsonError.textContent = error.message;
            jsonError.classList.remove('hidden');
        }
    }

    // Create sidebar navigation
    function createSidebarNavigation() {
        questionList.innerHTML = '';
        userAnswers.forEach((answer, index) => {
            const button = document.createElement('button');
            button.className = 'question-list-item';
            button.textContent = index + 1;
            
            // Set initial classes based on state
            if (answer.isFlagged) {
                button.classList.add('flagged');
            } else if (answer.selectedOption !== null) {
                button.classList.add('answered');
            }

            if (index === currentAbsoluteIndex) {
                button.classList.add('active');
            }

            button.addEventListener('click', () => goToQuestion(index));
            questionList.appendChild(button);
        });
    }

    // Update sidebar navigation colors
    function updateSidebarNavigation() {
        const buttons = questionList.querySelectorAll('.question-list-item');
        buttons.forEach((button, index) => {
            const answer = userAnswers[index];
            
            button.classList.remove('active', 'answered', 'flagged');
            
            if (answer.isFlagged) {
                button.classList.add('flagged');
            } else if (answer.selectedOption !== null) {
                button.classList.add('answered');
            }

            if (index === currentAbsoluteIndex) {
                button.classList.add('active');
            }
        });
    }
    
    // Render current question
    function renderQuestion() {
        if (!quizData || randomizedQuestions.length === 0) return;
        
        const questionData = randomizedQuestions[currentAbsoluteIndex];
        const userAnswer = userAnswers[currentAbsoluteIndex];

        // Clear quiz container
        quizContainer.innerHTML = '';
        
        // Render section title and instructions
        const sectionTitle = document.createElement('h3');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = questionData.sectionName;
        quizContainer.appendChild(sectionTitle);
        
        if (questionData.sectionInstructions) {
            const instructions = document.createElement('div');
            instructions.className = 'instructions';
            instructions.textContent = questionData.sectionInstructions;
            quizContainer.appendChild(instructions);
        }
        
        // Create question container
        const questionContainer = document.createElement('div');
        questionContainer.className = 'question-container';
        
        // Add question text and flag button
        const questionHeader = document.createElement('div');
        questionHeader.className = 'question-header';

        const questionText = document.createElement('div');
        questionText.className = 'question-text';
        questionText.innerHTML = `<strong>Question ${currentAbsoluteIndex + 1}:</strong> ${questionData.question}`;

        const flagButton = document.createElement('button');
        flagButton.className = 'btn btn-warning btn-sm flag-btn-question';
        flagButton.textContent = userAnswer.isFlagged ? 'Unflag' : 'Flag';
        flagButton.addEventListener('click', toggleFlag);

        questionHeader.appendChild(questionText);
        questionHeader.appendChild(flagButton);
        questionContainer.appendChild(questionHeader);
        
        // Add options
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'options-container';
        
        questionData.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'option';
            optionElement.textContent = option;
            optionElement.dataset.index = index;
            
            if (userAnswer && userAnswer.selectedOption === index) {
                optionElement.classList.add('selected');
            }
            
            optionElement.addEventListener('click', () => selectOption(index));
            optionsContainer.appendChild(optionElement);
        });
        
        questionContainer.appendChild(optionsContainer);
        quizContainer.appendChild(questionContainer);
        
        // Update navigation buttons and sidebar
        updateNavigation();
    }
    
    // Select an option
    function selectOption(optionIndex) {
        const userAnswer = userAnswers[currentAbsoluteIndex];
        const questionData = randomizedQuestions[currentAbsoluteIndex];
        
        userAnswer.selectedOption = optionIndex;
        
        // Find the original correct answer text before shuffling
        const originalQuestion = quizData.sections.find(s => s.questions.some(q => q.id === questionData.id)).questions.find(q => q.id === questionData.id);
        const originalCorrectOptionText = originalQuestion.options[originalQuestion.correctAnswer];
        userAnswer.isCorrect = (questionData.options[optionIndex] === originalCorrectOptionText);
        
        const options = document.querySelectorAll('.option');
        options.forEach(option => option.classList.remove('selected'));
        options[optionIndex].classList.add('selected');
        
        // Update sidebar color immediately
        updateSidebarNavigation();
    }
    
    // Update navigation buttons and sidebar
    function updateNavigation() {
        const isFirstQuestion = currentAbsoluteIndex === 0;
        const isLastQuestion = currentAbsoluteIndex === randomizedQuestions.length - 1;
        
        prevBtn.classList.toggle('hidden', isFirstQuestion);
        nextBtn.classList.toggle('hidden', isLastQuestion);
        submitBtn.classList.toggle('hidden', !isLastQuestion);

        // Update sidebar classes
        updateSidebarNavigation();
    }
    
    // Show previous question
    function showPreviousQuestion() {
        if (currentAbsoluteIndex > 0) {
            currentAbsoluteIndex--;
            renderQuestion();
        }
    }
    
    // Show next question
    function showNextQuestion() {
        if (currentAbsoluteIndex < randomizedQuestions.length - 1) {
            currentAbsoluteIndex++;
            renderQuestion();
        }
    }

    // Go to a specific question from the sidebar
    function goToQuestion(index) {
        if (index >= 0 && index < randomizedQuestions.length) {
            currentAbsoluteIndex = index;
            renderQuestion();
        }
    }

    // Toggle flag for a question
    function toggleFlag() {
        const userAnswer = userAnswers[currentAbsoluteIndex];
        userAnswer.isFlagged = !userAnswer.isFlagged;

        // Update the button text in the question header
        const flagButton = document.querySelector('.flag-btn-question');
        if (flagButton) {
            flagButton.textContent = userAnswer.isFlagged ? 'Unflag' : 'Flag';
        }

        updateSidebarNavigation();
    }
    
    // Toggle timer
    function toggleTimer() {
        if (timerToggle.checked) {
            startTimer();
        } else {
            stopTimer();
        }
    }
    
    // Start timer
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            secondsElapsed++;
            updateTimerDisplay();
        }, 1000);
    }
    
    // Stop timer
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }
    
    // Update timer display
    function updateTimerDisplay() {
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Show confirmation page before submitting
    function showConfirmationPage() {
        // Hide quiz panel and sidebar
        quizPanel.classList.add('hidden');
        sidebar.classList.add('hidden');

        // Generate summary content
        confirmationSummary.innerHTML = '';
        const summaryTable = document.createElement('table');
        summaryTable.className = 'summary-table';

        let tableBody = '<tbody>';
        const numColumns = 5; // Adjust number of columns for the grid
        const numRows = Math.ceil(userAnswers.length / numColumns);

        for (let i = 0; i < numRows; i++) {
            tableBody += '<tr>';
            for (let j = 0; j < numColumns; j++) {
                const questionIndex = i * numColumns + j;
                if (questionIndex < userAnswers.length) {
                    const userAnswer = userAnswers[questionIndex];
                    let status = 'Unanswered';
                    let statusClass = 'status-unanswered';
                    if (userAnswer.isFlagged) {
                        status = 'Flagged';
                        statusClass = 'status-flagged';
                    } else if (userAnswer.selectedOption !== null) {
                        status = 'Answered';
                        statusClass = 'status-answered';
                    }
                    tableBody += `
                        <td>
                            <div class="summary-item ${statusClass}" data-question-index="${questionIndex}">
                                <span class="summary-q-num">${questionIndex + 1}</span>
                                <span class="summary-q-status">${status}</span>
                            </div>
                        </td>
                    `;
                } else {
                    tableBody += '<td></td>'; // Empty cell for grid alignment
                }
            }
            tableBody += '</tr>';
        }
        tableBody += '</tbody>';

        summaryTable.innerHTML = tableBody;
        confirmationSummary.appendChild(summaryTable);

        // Show confirmation panel
        confirmationPanel.classList.remove('hidden');
    }
    
    // Submit quiz
    function submitQuiz() {
        stopTimer();
        
        // Calculate score
        const total = userAnswers.length;
        const correct = userAnswers.filter(answer => answer.isCorrect).length;
        
        // Update results panel
        scoreValue.textContent = correct;
        totalQuestions.textContent = total;
        
        reviewContainer.innerHTML = '';

        // Group answers by section
        const answersBySection = userAnswers.reduce((acc, userAnswer) => {
            const sectionName = userAnswer.questionData.sectionName;
            if (!acc[sectionName]) {
                acc[sectionName] = [];
            }
            acc[sectionName].push(userAnswer);
            return acc;
        }, {});

        // Generate review for each section
        for (const sectionName in answersBySection) {
            const sectionAnswers = answersBySection[sectionName];

            // Create section panel
            const sectionPanel = document.createElement('div');
            sectionPanel.className = 'review-section-panel card'; // Use card style

            const sectionHeader = document.createElement('h3');
            sectionHeader.className = 'review-section-header';
            sectionHeader.textContent = sectionName;
            sectionPanel.appendChild(sectionHeader);

            sectionAnswers.forEach(userAnswer => {
                const questionData = userAnswer.questionData;
                const reviewItem = document.createElement('div');
                reviewItem.className = 'review-item';
                
                // Add a border based on correctness
                if (userAnswer.selectedOption !== null) {
                    reviewItem.classList.add(userAnswer.isCorrect ? 'review-correct' : 'review-incorrect');
                }

                const status = userAnswer.isCorrect ? '✓ Correct' : '✗ Incorrect';
                const statusClass = userAnswer.isCorrect ? 'correct' : 'incorrect';
                const selectedOptionText = userAnswer.selectedOption !== null ? questionData.options[userAnswer.selectedOption] : 'No answer selected';
                
                const originalQuestion = quizData.sections.find(s => s.questions.some(q => q.id === questionData.id)).questions.find(q => q.id === questionData.id);
                const originalCorrectOptionText = originalQuestion.options[originalQuestion.correctAnswer];

                const questionIndex = randomizedQuestions.findIndex(q => q.id === questionData.id);

                reviewItem.innerHTML = `
                    <p><strong>Question ${questionIndex + 1}:</strong> ${questionData.question}</p>
                    <p>Your answer: ${selectedOptionText}</p>
                    <p>Correct answer: ${originalCorrectOptionText}</p>
                    <p class="${statusClass}">${status}</p>
                    ${questionData.explanation ? `<p class="explanation"><em>Explanation: ${questionData.explanation}</em></p>` : ''}
                `;
                
                sectionPanel.appendChild(reviewItem);
            });

            reviewContainer.appendChild(sectionPanel);
        }
        
        // Show results panel
        confirmationPanel.classList.add('hidden');
        quizPanel.classList.add('hidden');
        resultsPanel.classList.remove('hidden');
        sidebar.classList.add('hidden');
    }
    
    // Restart quiz
    function restartQuiz() {
        resultsPanel.classList.add('hidden');
        importPanel.classList.remove('hidden');
        userAnswers = [];
        randomizedQuestions = [];
        stopTimer();
        timerToggle.checked = false;
        seedInput.value = '';
    }
});