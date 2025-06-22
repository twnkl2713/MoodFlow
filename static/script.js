let moodEntries = [];
let moodChart = null;
let currentMood = 'neutral';

const moodKeywords = {
    happy: ['happy', 'joy', 'excited', 'great', 'awesome', 'amazing', 'wonderful', 'fantastic', 'good', 'smile', 'laugh', 'love', 'perfect', 'brilliant', 'excellent'],
    sad: ['sad', 'depressed', 'down', 'upset', 'cry', 'tears', 'hurt', 'pain', 'lonely', 'empty', 'hopeless', 'disappointed', 'grief', 'sorrow', 'devastated', 'die', 'suicidal', 'suicide'],
    stressed: ['stress', 'anxious', 'worried', 'overwhelmed', 'panic', 'nervous', 'tense', 'pressure', 'busy', 'exhausted', 'tired', 'deadline', 'workload', 'burnout', 'chaos', 'fuck', 'what the fuck', 'wtf', 'grinding', 'overload', 'freaking out', 'idk', 'man'],
    neutral: ['okay', 'fine', 'normal', 'regular', 'usual', 'calm', 'peaceful', 'quiet', 'steady', 'balanced']
};

document.addEventListener('DOMContentLoaded', function() {
    loadMoodEntries();
    initializeMoodChart();
    updateStats();
    updateTimeline();
    updateInsights();
            
    document.getElementById('entryText').addEventListener('input', analyzeMoodFromText);
            
            // Setup mood indicators
            document.querySelectorAll('.mood-indicator').forEach(indicator => {
                indicator.addEventListener('click', function() {
                    selectMood(this.dataset.mood);
                });
            });
        });

        // Mood Analysis
        function analyzeMoodFromText() {
            const text = document.getElementById('entryText').value.toLowerCase();
            if (text.length < 10) return;

            let moodScores = {
                happy: 0,
                sad: 0,
                stressed: 0,
                neutral: 0
            };

            // Score based on keywords
            Object.keys(moodKeywords).forEach(mood => {
                moodKeywords[mood].forEach(keyword => {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                    const matches = text.match(regex);
                    if (matches) {
                        moodScores[mood] += matches.length;
                    }
                });
            });

            // Determine dominant mood
            const dominantMood = Object.keys(moodScores).reduce((a, b) => 
                moodScores[a] > moodScores[b] ? a : b
            );

            // Update prediction if we found mood indicators
            if (moodScores[dominantMood] > 0) {
                updateMoodPrediction(dominantMood);
                selectMood(dominantMood);
            }
        }

        function updateMoodPrediction(mood) {
            const moodEmojis = {
                happy: '😊',
                sad: '😢',
                stressed: '😰',
                neutral: '😐'
            };

            const moodNames = {
                happy: 'Happy',
                sad: 'Sad',
                stressed: 'Stressed',
                neutral: 'Neutral'
            };

            document.querySelector('.prediction-mood').textContent = 
                `${moodNames[mood]} ${moodEmojis[mood]}`;
        }

        function selectMood(mood) {
            currentMood = mood;
            
            // Update mood indicators
            document.querySelectorAll('.mood-indicator').forEach(indicator => {
                indicator.classList.remove('active');
            });
            document.querySelector(`[data-mood="${mood}"]`).classList.add('active');
        }

        // Entry Management
        function addEntry() {
            const text = document.getElementById('entryText').value.trim();
            if (!text) return;

            const entry = {
                id: Date.now(),
                text: text,
                mood: currentMood,
                timestamp: new Date().toISOString(),
                date: new Date().toLocaleDateString()
            };

            moodEntries.unshift(entry);
            saveMoodEntries();
            
            // Clear form
            document.getElementById('entryText').value = '';
            selectMood('neutral');
            updateMoodPrediction('neutral');
            
            // Update UI
            updateStats();
            updateTimeline();
            updateChart();
            updateInsights();
            showSuccessToast();
        }

        function deleteEntry(id) {
            moodEntries = moodEntries.filter(entry => entry.id !== id);
            saveMoodEntries();
            updateStats();
            updateTimeline();
            updateChart();
            updateInsights();
        }

        // Data Persistence
        function saveMoodEntries() {
            // Using in-memory storage for Claude.ai compatibility
            // In a real app, you would use localStorage here
        }

        function loadMoodEntries() {
            // Initialize with sample data for demonstration
            moodEntries = [
                {
                    id: 1,
                    text: "Had a great day at work! Finished all my tasks and got positive feedback from my manager.",
                    mood: "happy",
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    date: new Date(Date.now() - 86400000).toLocaleDateString()
                },
                {
                    id: 2,
                    text: "Feeling overwhelmed with all the deadlines coming up. Need to manage my time better.",
                    mood: "stressed",
                    timestamp: new Date(Date.now() - 172800000).toISOString(),
                    date: new Date(Date.now() - 172800000).toLocaleDateString()
                }
            ];
        }

        // UI Updates
        function updateStats() {
            document.getElementById('totalEntries').textContent = moodEntries.length;
            
            // Calculate streak
            const today = new Date().toDateString();
            let streak = 0;
            const sortedEntries = [...moodEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            for (let i = 0; i < sortedEntries.length; i++) {
                const entryDate = new Date(sortedEntries[i].timestamp).toDateString();
                const expectedDate = new Date(Date.now() - (i * 86400000)).toDateString();
                
                if (entryDate === expectedDate) {
                    streak++;
                } else {
                    break;
                }
            }
            
            document.getElementById('currentStreak').textContent = streak;
            
            // Update mood counts
            const moodCounts = {
                happy: moodEntries.filter(entry => entry.mood === 'happy').length,
                sad: moodEntries.filter(entry => entry.mood === 'sad').length,
                stressed: moodEntries.filter(entry => entry.mood === 'stressed').length,
                neutral: moodEntries.filter(entry => entry.mood === 'neutral').length
            };
            
            document.getElementById('happyCount').textContent = moodCounts.happy;
            document.getElementById('sadCount').textContent = moodCounts.sad;
            document.getElementById('stressedCount').textContent = moodCounts.stressed;
            document.getElementById('neutralCount').textContent = moodCounts.neutral;
        }

        function updateTimeline() {
            const container = document.getElementById('timelineContainer');
            container.innerHTML = '';

            if (moodEntries.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <p>No entries yet. Start tracking your mood above!</p>
                    </div>
                `;
                return;
            }

            moodEntries.forEach(entry => {
                const moodEmojis = {
                    happy: '😊',
                    sad: '😢',
                    stressed: '😰',
                    neutral: '😐'
                };

                const entryElement = document.createElement('div');
                entryElement.className = 'timeline-entry';
                entryElement.innerHTML = `
                    <div class="entry-mood-icon">${moodEmojis[entry.mood]}</div>
                    <div class="entry-content">
                        <div class="entry-meta">
                            <span class="entry-date">${new Date(entry.timestamp).toLocaleString()}</span>
                            <button class="delete-entry-btn" onclick="deleteEntry(${entry.id})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                        <p class="entry-text">${entry.text}</p>
                    </div>
                `;
                container.appendChild(entryElement);
            });
        }

        function updateInsights() {
            const container = document.getElementById('insightsGrid');
            const insights = generateInsights();
            
            container.innerHTML = insights.map(insight => `
                <div class="insight-item ${insight.type}">
                    <h4 class="insight-title">${insight.title}</h4>
                    <p class="insight-description">${insight.description}</p>
                </div>
            `).join('');
        }

        function generateInsights() {
            const insights = [];
            
            if (moodEntries.length === 0) {
                return [{
                    type: 'info',
                    title: 'Start Your Journey',
                    description: 'Add your first mood entry to begin receiving personalized insights about your emotional patterns.'
                }];
            }

            // Most common mood
            const moodCounts = {
                happy: moodEntries.filter(e => e.mood === 'happy').length,
                sad: moodEntries.filter(e => e.mood === 'sad').length,
                stressed: moodEntries.filter(e => e.mood === 'stressed').length,
                neutral: moodEntries.filter(e => e.mood === 'neutral').length
            };

            const dominantMood = Object.keys(moodCounts).reduce((a, b) => 
                moodCounts[a] > moodCounts[b] ? a : b
            );

            const moodNames = {
                happy: 'happiness',
                sad: 'sadness',
                stressed: 'stress',
                neutral: 'neutrality'
            };

            if (moodCounts[dominantMood] > 0) {
                insights.push({
                    type: dominantMood === 'happy' ? 'positive' : dominantMood === 'sad' ? 'negative' : 'warning',
                    title: 'Dominant Emotion Pattern',
                    description: `Your most frequent emotion is ${moodNames[dominantMood]}. This represents ${Math.round((moodCounts[dominantMood] / moodEntries.length) * 100)}% of your recent entries.`
                });
            }

            // Recent trend
            const recentEntries = moodEntries.slice(0, 5);
            const recentHappy = recentEntries.filter(e => e.mood === 'happy').length;
            const recentSad = recentEntries.filter(e => e.mood === 'sad').length;

            if (recentHappy > recentSad) {
                insights.push({
                    type: 'positive',
                    title: 'Positive Trend Detected',
                    description: 'Your recent entries show more positive emotions. Keep up the good work and continue focusing on what makes you happy!'
                });
            } else if (recentSad > recentHappy && recentSad > 2) {
                insights.push({
                    type: 'negative',
                    title: 'Consider Self-Care',
                    description: 'You\'ve had several difficult days recently. Remember to take care of yourself and reach out for support when needed.'
                });
            }

            // Consistency insight
            const streak = parseInt(document.getElementById('currentStreak').textContent);
            if (streak >= 3) {
                insights.push({
                    type: 'positive',
                    title: 'Great Consistency!',
                    description: `You've been tracking your mood for ${streak} consecutive days. Consistent tracking leads to better self-awareness.`
                });
            }

            return insights;
        }

        // Chart Management
        function initializeMoodChart() {
            const ctx = document.getElementById('moodChart').getContext('2d');
            
            moodChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Happy', 'Sad', 'Stressed', 'Neutral'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: [
                            '#4ade80',
                            '#f87171',
                            '#fbbf24',
                            '#94a3b8'
                        ],
                        borderWidth: 0,
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
            
            updateChart();
        }

        function updateChart() {
            if (!moodChart) return;
            
            const moodCounts = [
                moodEntries.filter(entry => entry.mood === 'happy').length,
                moodEntries.filter(entry => entry.mood === 'sad').length,
                moodEntries.filter(entry => entry.mood === 'stressed').length,
                moodEntries.filter(entry => entry.mood === 'neutral').length
            ];
            
            moodChart.data.datasets[0].data = moodCounts;
            moodChart.update();
        }

        // Timeline Filtering
        function filterTimeline(period) {
            // Update active filter button
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            // Filter logic would go here
            // For now, just update the timeline with all entries
            updateTimeline();
        }

        // Export Functionality
        function exportAsJSON() {
            const dataStr = JSON.stringify(moodEntries, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = 'mood-data.json';
            link.click();
        }

        // Success Toast
        function showSuccessToast() {
            const toast = document.getElementById('successToast');
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Loading Overlay
        function showLoading() {
            document.getElementById('loadingOverlay').classList.add('show');
        }

        function hideLoading() {
            document.getElementById('loadingOverlay').classList.remove('show');
        }