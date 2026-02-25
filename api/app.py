import os
import sys
import subprocess
import threading
import time
import uuid

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    send_from_directory
)
from flask_socketio import SocketIO, emit, join_room

# =========================================================
# PATH SETUP
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, "templates")
DOWNLOAD_FOLDER = os.path.join(PROJECT_ROOT, "downloads")

os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# =========================================================
# FLASK APP INITIALIZATION (ONE INSTANCE ONLY)
# =========================================================

app = Flask(__name__, template_folder=TEMPLATES_DIR)
app.config["SECRET_KEY"] = "thisisjustthestart"

socketio = SocketIO(app, cors_allowed_origins="*")

# =========================================================
# GLOBAL STATE
# =========================================================

downloads = {}  # download_id -> metadata

# =========================================================
# HELPERS
# =========================================================

def safe_filename(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in (" ", "-", "_")).strip()

def get_video_title(url: str) -> str | None:
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "yt_dlp",
                "--get-title",
                "--no-playlist",
                url,
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
        return result.stdout.strip()
    except Exception:
        return None

# =========================================================
# DOWNLOAD WORKER (THREAD)
# =========================================================

def download_worker(download_id, url, output_template, format_spec, cookies_file):
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--no-playlist",
        "--no-check-certificate",
        "--newline",
        "--progress",
        "-o",
        output_template,
        "-f",
        format_spec,
        url,
    ]

    if cookies_file:
        cmd.extend(["--cookies", cookies_file])

    downloads[download_id]["status"] = "downloading"
    downloads[download_id]["start_time"] = time.time()

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    for line in iter(process.stdout.readline, ""):
        line = line.strip()
        if not line:
            continue

        socketio.emit(
            "progress",
            {"id": download_id, "line": line},
            room=download_id,
        )

        if "%" in line:
            try:
                percent = float(line.split("%")[0].split()[-1])
                downloads[download_id]["percent"] = percent
            except Exception:
                pass

    process.wait()

    if process.returncode == 0:
        downloads[download_id]["status"] = "completed"
        downloads[download_id]["end_time"] = time.time()

        with app.app_context():
            socketio.emit("completed", {"id": download_id}, room=download_id)
            socketio.emit("files_updated", broadcast=True)
    else:
        downloads[download_id]["status"] = "failed"
        with app.app_context():
            socketio.emit("failed", {"id": download_id}, room=download_id)

# =========================================================
# ROUTES
# =========================================================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/start_download", methods=["POST"])
def start_download():
    url = request.form["url"]
    format_spec = request.form.get("format", "best")
    cookies = request.form.get("cookies") or None

    download_id = str(uuid.uuid4())

    title = get_video_title(url) or f"video_{download_id[:8]}"
    safe_title = safe_filename(title)

    output_template = os.path.join(
        DOWNLOAD_FOLDER, f"{safe_title}.%(ext)s"
    )

    downloads[download_id] = {
        "url": url,
        "title": safe_title,
        "status": "queued",
        "percent": 0,
        "output_template": output_template,
    }

    thread = threading.Thread(
        target=download_worker,
        args=(download_id, url, output_template, format_spec, cookies),
        daemon=True,
    )
    thread.start()

    return jsonify({"download_id": download_id})

@app.route("/status/<download_id>")
def get_status(download_id):
    return jsonify(downloads.get(download_id, {}))

@app.route("/files")
def list_files():
    files = []
    for name in os.listdir(DOWNLOAD_FOLDER):
        path = os.path.join(DOWNLOAD_FOLDER, name)
        if os.path.isfile(path):
            files.append(
                {
                    "name": name,
                    "size": os.path.getsize(path),
                    "modified": os.path.getmtime(path),
                }
            )
    files.sort(key=lambda f: f["modified"], reverse=True)
    return jsonify(files)

@app.route("/active_downloads")
def active_downloads():
    count = sum(
        1
        for d in downloads.values()
        if d["status"] in ("queued", "downloading")
    )
    return jsonify({"count": count})

@app.route("/downloads/<path:filename>")
def download_file(filename):
    return send_from_directory(DOWNLOAD_FOLDER, filename, as_attachment=False)

# =========================================================
# SOCKET.IO EVENTS
# =========================================================

@socketio.on("connect")
def on_connect():
    print("Client connected")

@socketio.on("subscribe")
def on_subscribe(data):
    download_id = data.get("download_id")
    if download_id:
        join_room(download_id)
        emit("subscribed", {"id": download_id})

# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)