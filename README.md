# yot_downloader

A simple, fast, and self-hosted web application for downloading videos from YouTube and hundreds of other sites. It provides a clean browser UI with real-time progress updates delivered over WebSockets, audio notifications for every download event, and an instant file library to stream or re-download your videos.

---

## Features

- **One-click downloads** – paste any URL supported by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and hit *Start Download*
- **Real-time progress** – live output is streamed to the browser via Socket.IO (no page refresh needed)
- **Audio notifications** – distinct tones play when a download starts, completes, or fails (Web Audio API, no extra files required)
- **Format selection** – pass any yt-dlp format string (e.g. `best`, `bestvideo+bestaudio`, `mp3`)
- **Cookie support** – supply a cookies.txt path to access age-restricted or login-only content
- **File library** – all downloaded files are listed with name, size, and date; each file can be streamed or saved directly from the browser
- **Live stats badge** – a persistent badge shows how many files have been downloaded and the total storage used
- **Toast notifications** – non-intrusive pop-up messages confirm every action
- **No playlist downloads** – `--no-playlist` is enforced so single-video URLs are never accidentally expanded

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.8 + |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | latest recommended |
| ffmpeg *(optional)* | for merging video + audio streams |

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/AllanRye9/yot_downloader.git
cd yot_downloader

# 2. Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install Python dependencies
pip install flask flask-socketio

# 4. Install yt-dlp
pip install yt-dlp
# or: sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp
```

---

## Usage

```bash
python video.py
```

The server starts at **http://127.0.0.1:5000** by default.

1. Open the URL in your browser.
2. Paste a video URL into the *Video URL* field.
3. *(Optional)* Change the **Format** string or provide a **Cookies** file path.
4. Click **Start Download**.
5. Watch the live progress in the console output area; a success tone plays when the download finishes.
6. The downloaded file appears in the **Downloaded Videos** list where you can stream or save it.

### Format examples

| Format string | Result |
|---------------|--------|
| `best` | Best single-file quality (default) |
| `bestvideo+bestaudio` | Best quality with ffmpeg merge |
| `bestvideo[height<=720]+bestaudio` | Cap at 720p |
| `mp3` | Audio only (requires ffmpeg) |

---

## Project Structure

```
yot_downloader/
├── video.py            # Flask application & download logic
├── templates/
│   └── index.html      # Single-page frontend (HTML + CSS + JS)
├── downloads/          # Created automatically; stores downloaded files
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the main UI |
| `POST` | `/start_download` | Starts a download; returns `{"download_id": "..."}` |
| `GET` | `/status/<download_id>` | Returns status/progress for a specific download |
| `GET` | `/files` | Lists all files in the downloads folder |
| `GET` | `/active_downloads` | Returns the count of active/queued downloads |
| `GET` | `/downloads/<filename>` | Streams a downloaded file to the browser |

### Socket.IO events

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Server → Client | `progress` | `{id, line}` | Raw yt-dlp output line |
| Server → Client | `completed` | `{id}` | Download finished successfully |
| Server → Client | `failed` | `{id}` | Download encountered an error |
| Server → Client | `files_updated` | *(none)* | Broadcast when file list changes |
| Client → Server | `subscribe` | `{download_id}` | Join a room to receive progress for a specific download |

---

## Configuration

| Variable | Location | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | `video.py` | `'thisisjustthestart'` | Flask session secret – **change in production** |
| `DOWNLOAD_FOLDER` | `video.py` | `'downloads'` | Directory where files are saved |
| `cors_allowed_origins` | `video.py` | `"*"` | Restrict in production to your domain |

---

## Tech Stack

- **Backend** – Python, Flask, Flask-SocketIO
- **Downloader** – yt-dlp
- **Frontend** – Vanilla HTML/CSS/JavaScript, Socket.IO client
- **Audio** – Web Audio API (no external audio files)
- **Icons** – Font Awesome 6

---

## License

This project is provided as-is for personal and educational use.
