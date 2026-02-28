# Copilot Instructions for yot_downloader

## Project Overview
`yot_downloader` is a self-hosted web application that lets users download videos from YouTube and hundreds of other sites. It exposes a browser-based UI with real-time progress bars powered by Socket.IO and uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) under the hood.

## Tech Stack
- **Backend**: Python 3.11+ (Dockerfile pins 3.12), Flask, Flask-SocketIO (eventlet async mode), Flask-CORS
- **Downloader**: yt-dlp (invoked as a subprocess via `sys.executable -m yt_dlp`)
- **Frontend**: Single-page app in `templates/index.html` — vanilla HTML, CSS, and JavaScript with the Socket.IO client
- **Audio**: Web Audio API (no external audio files)
- **Icons**: Font Awesome 6

## Directory Structure
```
yot_downloader/
├── api/
│   └── app.py          # All Flask routes, Socket.IO events, download logic, cleanup
├── templates/
│   └── index.html      # Single-page frontend
├── downloads/          # Auto-created; stores downloaded files (not committed)
├── requirements.txt    # Python dependencies (pip)
├── Dockerfile          # Docker build (Python 3.12 slim image; minimum runtime is 3.11)
└── README.md
```

## Running the Application
```bash
# Install dependencies
pip install -r requirements.txt

# Start the development server
python api/app.py
# Server starts at http://127.0.0.1:5000

# Or with Docker
docker build -t yot_downloader .
docker run -p 5000:5000 yot_downloader
```

## Key Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | random hex | Flask session secret — always set in production |
| `ALLOWED_ORIGINS` | `"*"` | Comma-separated CORS origins — restrict in production |
| `PORT` | `5000` | Server port |
| `FLASK_DEBUG` | *(unset)* | Set to `"true"` to enable debug logging |

## Coding Conventions
- All application logic lives in `api/app.py`; keep it self-contained.
- Use the `Config` class at the top of `app.py` for all tunable constants — do not scatter magic numbers through the code.
- Protect every access to the shared `downloads` dict and `ip_download_count` dict with `downloads_lock` (an `RLock`).
- Subprocess calls to yt-dlp must always pass `get_ssl_env()` as the `env` argument to propagate SSL certificate paths.
- Route handlers should return `jsonify(...)` for API endpoints; only `/` returns a rendered template.
- Use the `@rate_limit()` decorator on any endpoint that triggers a download.
- Filename sanitisation is done by `safe_filename()`; always pass user-supplied names through it before using them in file paths.
- Security: validate that file paths are inside `DOWNLOAD_FOLDER` with `os.path.abspath` before any file operation.
- Prefer the standard library (`threading`, `subprocess`, `os`, `re`) over third-party equivalents where functionality is equivalent.

## API Surface
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/` | Serve the UI |
| `POST` | `/start_download` | Enqueue a download |
| `GET` | `/status/<id>` | Poll download status |
| `GET` | `/files` | List downloaded files |
| `GET` | `/active_downloads` | List in-progress downloads |
| `GET` | `/stats` | Storage and concurrency stats |
| `GET` | `/downloads/<filename>` | Stream a file to the browser |
| `DELETE` | `/delete/<filename>` | Delete a file |
| `POST` | `/cancel/<id>` | Cancel a running download |
| `GET` | `/health` | Health check |

## Socket.IO Events
| Direction | Event | Payload |
|-----------|-------|---------|
| Server → Client | `progress` | `{id, line, percent, speed, eta, size}` |
| Server → Client | `completed` | `{id, filename, title}` |
| Server → Client | `failed` | `{id, error}` |
| Server → Client | `cancelled` | `{id}` |
| Server → Client | `files_updated` | *(none)* |
| Client → Server | `subscribe` | `{download_id}` |

## Testing
There is currently no automated test suite. When adding tests, use `pytest` and mock `subprocess.Popen`/`subprocess.run` to avoid real network calls.

## Common Pitfalls
- yt-dlp is called as a **subprocess**, not imported as a library — changes to CLI flags must be reflected in the `cmd` list inside `download_worker` and `get_video_info`.
- The cleanup thread runs on a daemon thread; ensure state mutations inside it acquire `downloads_lock`.
- `downloads` keys are removed after 1 hour post-completion — do not rely on them persisting indefinitely.
- `ALLOWED_ORIGINS` defaults to `"*"`; remind users to restrict this before exposing the app to the public internet.
