class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentTrackIndex = 0;
        this.playlist = [];
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.progressBar = document.querySelector('.progress-bar');
        this.progress = document.getElementById('progress');
        this.currentTime = document.querySelector('.current-time');
        this.totalTime = document.querySelector('.total-time');
        this.volumeControl = document.getElementById('volume');
        this.playButton = document.querySelector('.play-btn');
        this.prevButton = document.querySelector('.prev-btn');
        this.nextButton = document.querySelector('.next-btn');
    }

    setupEventListeners() {
        // Progress bar click
        this.progressBar.addEventListener('click', (e) => {
            const rect = this.progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            this.audio.currentTime = pos * this.audio.duration;
        });

        // Time update
        this.audio.addEventListener('timeupdate', () => {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progress.style.width = `${percent}%`;
            this.currentTime.textContent = this.formatTime(this.audio.currentTime);
        });

        // Track loaded
        this.audio.addEventListener('loadedmetadata', () => {
            this.totalTime.textContent = this.formatTime(this.audio.duration);
            this.prevButton.disabled = this.currentTrackIndex <= 0;
            this.nextButton.disabled = this.currentTrackIndex >= this.playlist.length - 1;
        });

        // Volume control
        this.volumeControl.addEventListener('input', (e) => {
            this.audio.volume = e.target.value / 100;
        });

        // Error handling
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.showError('Error playing track. Please try again.');
            this.isPlaying = false;
            this.updatePlayButton();
        });
    }

    loadTrack(track) {
        try {
            this.audio.src = track.preview_url;
            this.audio.load();
            this.play();
        } catch (error) {
            this.showError('Error loading track');
            console.error('Track load error:', error);
        }
    }

    play() {
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
                this.updatePlayButton();
            }).catch(error => {
                console.error('Playback error:', error);
                this.showError('Playback failed. Please try again.');
            });
        }
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();
    }

    updatePlayButton() {
        if (this.playButton) {
            this.playButton.textContent = this.isPlaying ? 'Pause' : 'Play';
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.querySelector('.player-container').prepend(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 3000);
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.audioPlayer = new AudioPlayer();
});
