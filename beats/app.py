from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from flask_cors import CORS
import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
from functools import wraps

load_dotenv()

app = Flask(__name__)
CORS(app)
app.secret_key = os.urandom(24)

# Spotify API credentials
SPOTIPY_CLIENT_ID = os.getenv('SPOTIPY_CLIENT_ID')
SPOTIPY_CLIENT_SECRET = os.getenv('SPOTIPY_CLIENT_SECRET')
SPOTIPY_REDIRECT_URI = os.getenv('SPOTIPY_REDIRECT_URI', 'http://localhost:5000/callback')
SCOPE = 'user-library-read playlist-read-private user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private'

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('token_info'):
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login')
def login_page():
    if session.get('token_info'):
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/auth')
def auth():
    sp_oauth = create_spotify_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route('/callback')
def callback():
    sp_oauth = create_spotify_oauth()
    session.clear()
    code = request.args.get('code')
    token_info = sp_oauth.get_access_token(code)
    session['token_info'] = token_info
    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))

@app.route('/')
@login_required
def index():
    token_info = session.get('token_info')
    return render_template('index.html', 
                         authenticated=True,
                         token=token_info['access_token'] if token_info else None)

@app.route('/token')
@login_required
def get_token():
    token_info = session.get('token_info')
    if not token_info:
        return jsonify({'error': 'No token info'}), 401
    return jsonify({'token': token_info['access_token']})

@app.route('/search')
@login_required
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No search query provided'}), 400
    
    sp = get_spotify_client()
    results = sp.search(q=query, limit=10, type='track')
    tracks = results['tracks']['items']
    
    formatted_tracks = [{
        'id': track['id'],
        'name': track['name'],
        'artist': track['artists'][0]['name'],
        'album': track['album']['name'],
        'image': track['album']['images'][0]['url'] if track['album']['images'] else None,
        'preview_url': track['preview_url']
    } for track in tracks]
    
    return jsonify(formatted_tracks)

@app.route('/play/<track_id>', methods=['POST'])
@login_required
def play_track(track_id):
    sp = get_spotify_client()
    try:
        device_id = request.args.get('device_id')
        sp.start_playback(device_id=device_id, uris=[f'spotify:track:{track_id}'])
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/playlists')
@login_required
def get_playlists():
    sp = get_spotify_client()
    try:
        playlists = sp.current_user_playlists()
        formatted_playlists = [{
            'id': playlist['id'],
            'name': playlist['name'],
            'image': playlist['images'][0]['url'] if playlist['images'] else None,
            'tracks_total': playlist['tracks']['total']
        } for playlist in playlists['items']]
        return jsonify(formatted_playlists)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/playlist/<playlist_id>/tracks')
@login_required
def get_playlist_tracks(playlist_id):
    sp = get_spotify_client()
    try:
        results = sp.playlist_tracks(playlist_id)
        tracks = results['items']
        
        formatted_tracks = [{
            'id': track['track']['id'],
            'name': track['track']['name'],
            'artist': track['track']['artists'][0]['name'],
            'album': track['track']['album']['name'],
            'image': track['track']['album']['images'][0]['url'] if track['track']['album']['images'] else None,
            'preview_url': track['track']['preview_url']
        } for track in tracks if track['track']]
        
        return jsonify(formatted_tracks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_spotify_oauth():
    return SpotifyOAuth(
        client_id=SPOTIPY_CLIENT_ID,
        client_secret=SPOTIPY_CLIENT_SECRET,
        redirect_uri=SPOTIPY_REDIRECT_URI,
        scope=SCOPE
    )

def get_spotify_client():
    token_info = session.get('token_info')
    if not token_info:
        raise Exception('No token info')
    return spotipy.Spotify(auth=token_info['access_token'])

if __name__ == '__main__':
    app.run(debug=True)