import os
import sys
import subprocess
import threading
import time
import uuid
import shutil
import json
import glob
import certifi
from pathlib import Path
from datetime import datetime

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    send_from_directory,
    url_for,
    Response
)
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS

# =========================================================
# PATH SETUP
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DOWNLOAD_FOLDER = os.path.join(BASE_DIR, "downloads")

# Create directories if they don't exist
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# =========================================================
# FLASK APP INITIALIZATION
# =========================================================

app = Flask(__name__, 
            template_folder=TEMPLATES_DIR,
            static_folder=STATIC_DIR)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "railway-deployment-key")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload
app.config["DOWNLOAD_FOLDER"] = DOWNLOAD_FOLDER

# Enable CORS for Railway
CORS(app)

# SocketIO setup for real-time updates
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# =========================================================
# GLOBAL STATE
# =========================================================

downloads = {}  # download_id -> metadata
active_threads = {}  # download_id -> thread

# =========================================================
# CHECK DEPENDENCIES
# =========================================================

def check_yt_dlp():
    """Check if yt-dlp is installed and accessible"""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "yt_dlp", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print(f"✅ yt-dlp version: {result.stdout.strip()}")
            return True
        else:
            print("❌ yt-dlp not found")
            return False
    except Exception as e:
        print(f"❌ Error checking yt-dlp: {e}")
        return False

def check_ffmpeg():
    """Check if ffmpeg is installed (needed for format conversion)"""
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        print(f"✅ ffmpeg found at: {ffmpeg_path}")
        return True
    else:
        print("⚠️ ffmpeg not found - some formats may not work")
        return False

# =========================================================
# HELPERS
# =========================================================

def safe_filename(name: str) -> str:
    """Create a safe filename"""
    # Remove invalid characters
    name = "".join(c for c in name if c.isalnum() or c in (" ", "-", "_", ".", "(", ")"))
    # Limit length
    if len(name) > 100:
        name = name[:100]
    return name.strip()

def format_size(size_bytes):
    """Format file size"""
    if size_bytes == 0:
        return "0 B"
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.2f} {size_names[i]}"

def get_ssl_env() -> dict:
    """Return a copy of the current environment with SSL certificate vars set."""
    env = os.environ.copy()
    env["SSL_CERT_FILE"] = certifi.where()
    env["REQUESTS_CA_BUNDLE"] = certifi.where()
    return env

def get_video_info(url: str) -> dict:
    """Get video information without downloading"""
    try:
        cmd = [
            sys.executable,
            "-m",
            "yt_dlp",
            "--no-playlist",
            "--dump-json",
            "--no-check-certificate",
            url,
        ]
        
        env = get_ssl_env()

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
            env=env,
        )
        
        info = json.loads(result.stdout)
        
        return {
            "title": info.get("title", "Unknown"),
            "duration": info.get("duration", 0),
            "uploader": info.get("uploader", "Unknown"),
            "thumbnail": info.get("thumbnail", ""),
            "formats": [
                {
                    "format_id": f.get("format_id"),
                    "ext": f.get("ext"),
                    "resolution": f.get("resolution", "N/A"),
                    "filesize": f.get("filesize", 0),
                    "format_note": f.get("format_note", "")
                }
                for f in info.get("formats", [])
                if f.get("vcodec") != "none"  # Video formats only
            ],
            "audio_formats": [
                {
                    "format_id": f.get("format_id"),
                    "ext": f.get("ext"),
                    "abr": f.get("abr", 0),
                    "filesize": f.get("filesize", 0),
                    "format_note": f.get("format_note", "")
                }
                for f in info.get("formats", [])
                if f.get("acodec") != "none" and f.get("vcodec") == "none"
            ]
        }
    except subprocess.TimeoutExpired:
        return {"error": "Request timeout"}
    except subprocess.CalledProcessError as e:
        return {"error": f"yt-dlp error: {e.stderr}"}
    except Exception as e:
        return {"error": str(e)}

def parse_progress(line):
    """Parse progress from yt-dlp output"""
    # Look for percentage
    import re
    percent_match = re.search(r'(\d+(?:\.\d+)?)%', line)
    percent = float(percent_match.group(1)) if percent_match else 0
    
    # Look for speed
    speed_match = re.search(r'at\s+([\d.]+[KMG]?i?B/s)', line)
    speed = speed_match.group(1) if speed_match else ""
    
    # Look for ETA
    eta_match = re.search(r'ETA\s+(\d+:\d+)', line)
    eta = eta_match.group(1) if eta_match else ""
    
    return {
        "percent": percent,
        "speed": speed,
        "eta": eta,
        "raw": line
    }

# =========================================================
# DOWNLOAD WORKER (THREAD)
# =========================================================

def download_worker(download_id, url, output_template, format_spec, cookies_file=None):
    """Background thread for downloading"""
    
    # Build command
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

    # Add cookies if provided
    if cookies_file and cookies_file.strip():
        # Check if it's a file path or cookie string
        if os.path.exists(cookies_file):
            cmd.extend(["--cookies", cookies_file])
        else:
            # Assume it's a cookies string, write to temp file
            cookies_path = os.path.join('/tmp', f'cookies_{download_id}.txt')
            with open(cookies_path, 'w') as f:
                f.write(cookies_file)
            cmd.extend(["--cookies", cookies_path])

    # Add ffmpeg if available for post-processing
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        cmd.extend(["--ffmpeg-location", ffmpeg_path])

    downloads[download_id]["status"] = "downloading"
    downloads[download_id]["start_time"] = time.time()
    downloads[download_id]["cmd"] = " ".join(cmd)

    proc_env = get_ssl_env()

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True,
            env=proc_env,
        )

        for line in iter(process.stdout.readline, ""):
            line = line.strip()
            if not line:
                continue

            # Parse progress
            progress = parse_progress(line)
            
            # Update download info
            downloads[download_id]["percent"] = progress["percent"]
            downloads[download_id]["last_line"] = line
            downloads[download_id]["speed"] = progress["speed"]
            downloads[download_id]["eta"] = progress["eta"]

            # Emit progress via socketio
            socketio.emit(
                "progress",
                {
                    "id": download_id,
                    "line": line,
                    "percent": progress["percent"],
                    "speed": progress["speed"],
                    "eta": progress["eta"]
                },
                room=download_id,
            )

        process.wait()

        if process.returncode == 0:
            downloads[download_id]["status"] = "completed"
            downloads[download_id]["end_time"] = time.time()
            downloads[download_id]["percent"] = 100

            # Find downloaded file
            base_name = os.path.splitext(os.path.basename(output_template))[0]
            for file in os.listdir(DOWNLOAD_FOLDER):
                if file.startswith(base_name):
                    file_path = os.path.join(DOWNLOAD_FOLDER, file)
                    downloads[download_id]["filename"] = file
                    downloads[download_id]["file_size"] = os.path.getsize(file_path)
                    downloads[download_id]["file_size_hr"] = format_size(os.path.getsize(file_path))
                    break

            socketio.emit("completed", {
                "id": download_id,
                "filename": downloads[download_id].get("filename"),
                "title": downloads[download_id].get("title")
            }, room=download_id)
            socketio.emit("files_updated", broadcast=True)
        else:
            downloads[download_id]["status"] = "failed"
            downloads[download_id]["error"] = f"Process exited with code {process.returncode}"
            socketio.emit("failed", {
                "id": download_id,
                "error": downloads[download_id]["error"]
            }, room=download_id)

    except Exception as e:
        downloads[download_id]["status"] = "failed"
        downloads[download_id]["error"] = str(e)
        socketio.emit("failed", {
            "id": download_id,
            "error": str(e)
        }, room=download_id)
    
    finally:
        # Clean up thread reference
        if download_id in active_threads:
            del active_threads[download_id]
        
        # Clean up temp cookies
        try:
            cookies_path = os.path.join('/tmp', f'cookies_{download_id}.txt')
            if os.path.exists(cookies_path):
                os.remove(cookies_path)
        except:
            pass

# =========================================================
# ROUTES
# =========================================================

@app.route("/")
def index():
    """Main page"""
    return render_template("index.html")

@app.route("/start_download", methods=["POST"])
def start_download():
    """Start a download"""
    url = request.form.get("url")
    format_spec = request.form.get("format", "best")
    cookies = request.form.get("cookies", "")
    
    if not url:
        return jsonify({"error": "URL is required"}), 400
    
    download_id = str(uuid.uuid4())
    
    # Get video info first
    info = get_video_info(url)
    if info and "error" not in info:
        title = info.get("title", f"video_{download_id[:8]}")
    else:
        title = f"video_{download_id[:8]}"
    
    safe_title = safe_filename(title)
    
    # Create output template
    output_template = os.path.join(
        DOWNLOAD_FOLDER, 
        f"{safe_title}.%(ext)s"
    )
    
    # Store download info
    downloads[download_id] = {
        "id": download_id,
        "url": url,
        "title": title,
        "safe_title": safe_title,
        "status": "queued",
        "percent": 0,
        "output_template": output_template,
        "format": format_spec,
        "created_at": time.time(),
        "filename": None,
        "info": info if info and "error" not in info else None
    }
    
    # Start download thread
    thread = threading.Thread(
        target=download_worker,
        args=(download_id, url, output_template, format_spec, cookies),
        daemon=True,
    )
    thread.start()
    active_threads[download_id] = thread
    
    return jsonify({
        "download_id": download_id,
        "title": title,
        "status": "queued"
    })

@app.route("/status/<download_id>")
def get_status(download_id):
    """Get download status"""
    download = downloads.get(download_id, {})
    return jsonify(download)

@app.route("/files")
def list_files():
    """List downloaded files"""
    files = []
    try:
        for name in os.listdir(DOWNLOAD_FOLDER):
            path = os.path.join(DOWNLOAD_FOLDER, name)
            if os.path.isfile(path):
                stat = os.stat(path)
                files.append({
                    "name": name,
                    "size": stat.st_size,
                    "size_hr": format_size(stat.st_size),
                    "modified": stat.st_mtime,
                    "modified_str": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                    "url": url_for('download_file', filename=name, _external=True)
                })
        files.sort(key=lambda f: f["modified"], reverse=True)
    except Exception as e:
        print(f"Error listing files: {e}")
        return jsonify({"error": str(e)}), 500
    
    return jsonify(files)

@app.route("/active_downloads")
def active_downloads():
    """Get active downloads count"""
    count = sum(
        1
        for d in downloads.values()
        if d["status"] in ("queued", "downloading")
    )
    return jsonify({"count": count})

@app.route("/downloads/<path:filename>")
def download_file(filename):
    """Serve downloaded file"""
    try:
        return send_from_directory(DOWNLOAD_FOLDER, filename, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 404

@app.route("/delete/<path:filename>", methods=["DELETE"])
def delete_file(filename):
    """Delete a downloaded file"""
    try:
        filepath = os.path.join(DOWNLOAD_FOLDER, filename)
        # Security: prevent directory traversal
        if not os.path.abspath(filepath).startswith(os.path.abspath(DOWNLOAD_FOLDER)):
            return jsonify({"error": "Invalid filename"}), 400
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            os.remove(filepath)
            socketio.emit("files_updated", broadcast=True)
            return jsonify({"success": True})
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/stats")
def get_stats():
    """Get download statistics"""
    try:
        files = []
        total_size = 0
        for name in os.listdir(DOWNLOAD_FOLDER):
            path = os.path.join(DOWNLOAD_FOLDER, name)
            if os.path.isfile(path):
                size = os.path.getsize(path)
                total_size += size
                files.append(name)
        
        return jsonify({
            "count": len(files),
            "total_size": total_size,
            "total_size_hr": format_size(total_size),
            "active_downloads": sum(1 for d in downloads.values() if d["status"] in ("queued", "downloading"))
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/cancel/<download_id>", methods=["POST"])
def cancel_download(download_id):
    """Cancel an ongoing download"""
    if download_id in downloads:
        if downloads[download_id]["status"] in ("queued", "downloading"):
            downloads[download_id]["status"] = "cancelled"
            socketio.emit("cancelled", {"id": download_id}, room=download_id)
            return jsonify({"success": True, "status": "cancelled"})
    
    return jsonify({"error": "Download not found or cannot be cancelled"}), 404

# =========================================================
# SOCKET.IO EVENTS
# =========================================================

@socketio.on("connect")
def on_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")

@socketio.on("disconnect")
def on_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")

@socketio.on("subscribe")
def on_subscribe(data):
    """Subscribe to download updates"""
    download_id = data.get("download_id")
    if download_id:
        join_room(download_id)
        emit("subscribed", {"id": download_id})

# =========================================================
# CLEANUP THREAD
# =========================================================

def cleanup_old_files(max_age_hours=24):
    """Clean up files older than max_age_hours"""
    try:
        current_time = time.time()
        for filename in os.listdir(DOWNLOAD_FOLDER):
            filepath = os.path.join(DOWNLOAD_FOLDER, filename)
            if os.path.isfile(filepath):
                file_age = current_time - os.path.getmtime(filepath)
                if file_age > max_age_hours * 3600:
                    os.remove(filepath)
                    print(f"Cleaned up old file: {filename}")
    except Exception as e:
        print(f"Error during cleanup: {e}")

def cleanup_thread():
    """Background thread for cleanup"""
    while True:
        time.sleep(3600)  # Run every hour
        cleanup_old_files()

# =========================================================
# INITIALIZATION
# =========================================================

# Check dependencies on startup
print("=" * 50)
print("🚀 Starting YouTube Downloader on Railway")
print("=" * 50)
check_yt_dlp()
check_ffmpeg()
print(f"📁 Download folder: {DOWNLOAD_FOLDER}")
print(f"📁 Templates folder: {TEMPLATES_DIR}")
print("=" * 50)

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_thread, daemon=True)
cleanup_thread.start()

# =========================================================
# ERROR HANDLERS
# =========================================================

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    
    print(f"🌐 Starting server on port {port}")
    print(f"🐛 Debug mode: {debug}")
    
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=debug,
        allow_unsafe_werkzeug=True
    )
