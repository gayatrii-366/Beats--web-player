class MusicPlayer {
    constructor() {
        this.currentTrack = null;
        this.isPlaying = false;
        this.volume = 50;
        this.progress = 0;
        this.currentPlaylistTracks = [];
        this.player = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeSpotifyPlayer();
        this.checkAuthenticationStatus();
        this.loadPlaylists();
        this.initializeTheme();
    }

    initializeElements() {
        this.searchInput = document.getElementById('search');
        this.albumArt = document.getElementById('album-art');
        this.trackTitle = document.getElementById('track-title');
        this.artistName = document.getElementById('artist-name');
        this.playBtn = document.getElementById('play-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.volumeSlider = document.getElementById('volume');
        this.progressBar = document.getElementById('progress');
        this.trackList = document.getElementById('track-list');
        this.playlistsContainer = document.getElementById('user-playlists');
        this.themeToggle = document.getElementById('checkbox');
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 500));
        this.playBtn.addEventListener('click', () => this.togglePlayback());
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());
        if (this.themeToggle) {
            this.themeToggle.addEventListener('change', () => this.toggleTheme());
        }
    }

    initializeSpotifyPlayer() {
        window.onSpotifyWebPlaybackSDKReady = () => {
            const token = this.getSpotifyToken();
            this.player = new Spotify.Player({
                name: 'Beats Web Player',
                getOAuthToken: cb => { cb(token); },
                volume: 0.5
            });

            // Error handling
            this.player.addListener('initialization_error', ({ message }) => {
                console.error('Initialization error:', message);
                this.showError('Failed to initialize Spotify player');
            });
            this.player.addListener('authentication_error', ({ message }) => {
                console.error('Authentication error:', message);
                this.showError('Authentication failed. Please try logging in again.');
            });
            this.player.addListener('account_error', ({ message }) => {
                console.error('Account error:', message);
                this.showError('This feature requires Spotify Premium');
            });
            this.player.addListener('playback_error', ({ message }) => {
                console.error('Playback error:', message);
                this.showError('Failed to play track. Please try again.');
            });

            // Playback status updates
            this.player.addListener('player_state_changed', state => {
                if (state) {
                    this.isPlaying = !state.paused;
                    this.updatePlayButton();
                }
            });

            // Ready
            this.player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                this.deviceId = device_id;
            });

            // Connect to the player
            this.player.connect();
        };
    }

    showError(message) {
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Remove any existing error message
        const existingError = container.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        container.insertBefore(errorDiv, container.firstChild);
        
        // Remove the error message after 3 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    getSpotifyToken() {
        // Get token passed from backend
        return window.SPOTIFY_TOKEN;
    }

    async checkAuthenticationStatus() {
        const response = await fetch('/search?q=test');
        if (response.status === 401) {
            this.showLoginButton();
        }
    }

    showLoginButton() {
        const container = document.querySelector('.container');
        const loginBtn = document.createElement('button');
        loginBtn.textContent = 'Login with Spotify';
        loginBtn.className = 'login-btn';
        loginBtn.addEventListener('click', () => window.location.href = '/login');
        container.insertBefore(loginBtn, container.firstChild);
    }

    async handleSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.clearTrackList();
            return;
        }

        try {
            const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            
            const tracks = await response.json();
            this.displaySearchResults(tracks);
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    displaySearchResults(tracks) {
        this.clearTrackList();
        tracks.forEach(track => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="track-item">
                    <img src="${track.image || '/static/img/default-album.png'}" alt="Album art" class="track-item-image">
                    <div class="track-item-info">
                        <div class="track-item-title">${track.name}</div>
                        <div class="track-item-artist">${track.artist}</div>
                    </div>
                </div>
            `;
            li.addEventListener('click', () => this.playTrack(track));
            this.trackList.appendChild(li);
        });
    }

    async playTrack(track) {
        if (!this.player) {
            console.error('Spotify player not initialized');
            return;
        }

        if (this.currentTrack?.id === track.id) {
            this.togglePlayback();
            return;
        }

        try {
            const response = await fetch(`/play/${track.id}?device_id=${this.deviceId}`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to play track');
            
            this.currentTrack = track;
            this.updateNowPlaying(track);
            this.isPlaying = true;
            this.updatePlayButton();
        } catch (error) {
            console.error('Playback error:', error);
        }
    }

    updateNowPlaying(track) {
        this.albumArt.src = track.image || '/static/img/default-album.png';
        this.trackTitle.textContent = track.name;
        this.artistName.textContent = track.artist;
    }

    async togglePlayback() {
        if (!this.currentTrack || !this.player) return;
        
        try {
            if (this.isPlaying) {
                await this.player.pause();
            } else {
                await this.player.resume();
            }
            this.isPlaying = !this.isPlaying;
            this.updatePlayButton();
        } catch (error) {
            console.error('Error toggling playback:', error);
        }
    }

    updatePlayButton() {
        this.playBtn.textContent = this.isPlaying ? 'Pause' : 'Play';
    }

    async setVolume(value) {
        if (!this.player) return;
        this.volume = value;
        await this.player.setVolume(value / 100);
    }

    async playPrevious() {
        if (!this.player) return;
        try {
            await this.player.previousTrack();
        } catch (error) {
            console.error('Error playing previous track:', error);
            this.showPremiumError();
        }
    }

    async playNext() {
        if (!this.player) return;
        try {
            await this.player.nextTrack();
        } catch (error) {
            console.error('Error playing next track:', error);
            this.showPremiumError();
        }
    }

    showPremiumError() {
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'This feature requires a Spotify Premium account';
        
        // Remove any existing error message
        const existingError = container.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        container.insertBefore(errorDiv, container.firstChild);
        
        // Remove the error message after 3 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    clearTrackList() {
        this.trackList.innerHTML = '';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async loadPlaylists() {
        try {
            const response = await fetch('/playlists');
            if (!response.ok) throw new Error('Failed to fetch playlists');
            
            const playlists = await response.json();
            this.displayPlaylists(playlists);
        } catch (error) {
            console.error('Error loading playlists:', error);
        }
    }

    displayPlaylists(playlists) {
        this.playlistsContainer.innerHTML = '';
        
        playlists.forEach(playlist => {
            const playlistElement = document.createElement('div');
            playlistElement.className = 'playlist-item';
            playlistElement.innerHTML = `
                <div class="playlist-item-content">
                    <img src="${playlist.image || '/static/img/default-album.png'}" alt="${playlist.name}" class="playlist-image">
                    <div class="playlist-info">
                        <div class="playlist-name">${playlist.name}</div>
                        <div class="playlist-tracks">${playlist.tracks_total} tracks</div>
                    </div>
                </div>
            `;
            playlistElement.addEventListener('click', () => this.openPlaylist(playlist.id, playlist.name));
            this.playlistsContainer.appendChild(playlistElement);
        });
    }

    async openPlaylist(playlistId, playlistName) {
        try {
            const response = await fetch(`/playlist/${playlistId}/tracks`);
            if (!response.ok) throw new Error('Failed to fetch playlist tracks');
            
            const tracks = await response.json();
            this.currentPlaylistTracks = tracks;
            this.displayPlaylistTracks(tracks, playlistName);
        } catch (error) {
            console.error('Error opening playlist:', error);
        }
    }

    displayPlaylistTracks(tracks, playlistName) {
        // Clear the track list
        this.trackList.innerHTML = '';
        
        // Update the playlist title
        const playlistHeader = this.trackList.closest('.playlist').querySelector('h3');
        playlistHeader.textContent = playlistName;

        // Display the tracks
        tracks.forEach(track => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="track-item">
                    <img src="${track.image || '/static/img/default-album.png'}" alt="Album art" class="track-item-image">
                    <div class="track-item-info">
                        <div class="track-item-title">${track.name}</div>
                        <div class="track-item-artist">${track.artist}</div>
                    </div>
                </div>
            `;
            li.addEventListener('click', () => this.playTrack(track));
            this.trackList.appendChild(li);
        });
    }

    initializeTheme() {
        // Get theme from localStorage or default to dark
        const currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        
        // Update checkbox state
        if (this.themeToggle) {
            this.themeToggle.checked = currentTheme === 'light';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
}

// Initialize the player when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});