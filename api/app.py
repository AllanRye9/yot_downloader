import os
import sys
import subprocess
import threading
import time
import uuid
import shutil
import json
import logging
import certifi
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    send_from_directory,
    url_for,
)
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

# =========================================================
# PRODUCTION CONFIGURATION
# =========================================================

class Config:
    """Production configuration"""
    SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(24).hex())
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max upload
    DOWNLOAD_FOLDER = "downloads"
    TEMPLATES_FOLDER = "templates"
    STATIC_FOLDER = "static"
    MAX_DOWNLOADS_PER_IP = 5
    MAX_CONCURRENT_DOWNLOADS = 3
    DOWNLOAD_TIMEOUT = 3600  # 1 hour
    CLEANUP_INTERVAL = 3600  # 1 hour
    FILE_RETENTION_HOURS = 24
    SESSION_TYPE = 'filesystem'
    PERMANENT_SESSION_LIFETIME = timedelta(hours=1)

# =========================================================
# PATH SETUP
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = BASE_DIR  # Assuming app.py is in root

# Handle case where app.py is in api/ subdirectory
if os.path.basename(BASE_DIR) == "api":
    ROOT_DIR = os.path.dirname(BASE_DIR)

TEMPLATES_DIR = os.path.join(ROOT_DIR, Config.TEMPLATES_FOLDER)
STATIC_DIR = os.path.join(ROOT_DIR, Config.STATIC_FOLDER)
DOWNLOAD_FOLDER = os.path.join(ROOT_DIR, Config.DOWNLOAD_FOLDER)

# Create directories
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# =========================================================
# LOGGING SETUP
# =========================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(ROOT_DIR, 'app.log'))
    ]
)
logger = logging.getLogger(__name__)

# =========================================================
# FLASK APP INITIALIZATION
# =========================================================

app = Flask(__name__, 
            template_folder=TEMPLATES_DIR,
            static_folder=STATIC_DIR,
            static_url_path='/static')

app.config.from_object(Config)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# Enable CORS with production settings
CORS(app, resources={
    r"/*": {
        "origins": os.environ.get("ALLOWED_ORIGINS", "*").split(","),
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Socket.IO with production settings
socketio = SocketIO(
    app,
    cors_allowed_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    async_mode='eventlet',
    logger=True if os.environ.get("FLASK_DEBUG") else False,
    engineio_logger=True if os.environ.get("FLASK_DEBUG") else False,
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1e8,
    manage_session=False
)

# =========================================================
# GLOBAL STATE WITH THREAD SAFETY
# =========================================================

from threading import Lock, RLock

downloads_lock = RLock()  # Reentrant lock for nested access
downloads = {}            # download_id -> metadata
active_threads = {}       # download_id -> thread
ip_download_count = {}    # ip -> count

# =========================================================
# SSL CERTIFICATE FIX
# =========================================================

os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

# =========================================================
# RATE LIMITING DECORATOR
# =========================================================

def rate_limit(max_per_ip=Config.MAX_DOWNLOADS_PER_IP):
    """Rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            with downloads_lock:
                count = ip_download_count.get(ip, 0)
                if count >= max_per_ip:
                    return jsonify({
                        "error": f"Rate limit exceeded. Maximum {max_per_ip} concurrent downloads per IP."
                    }), 429
                ip_download_count[ip] = count + 1
            
            try:
                return f(*args, **kwargs)
            finally:
                with downloads_lock:
                    ip_download_count[ip] = ip_download_count.get(ip, 1) - 1
                    if ip_download_count[ip] <= 0:
                        ip_download_count.pop(ip, None)
        return wrapped
    return decorator

# =========================================================
# DEPENDENCY CHECKS
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
            logger.info(f"✅ yt-dlp version: {result.stdout.strip()}")
            return True
        else:
            logger.error("❌ yt-dlp not found")
            return False
    except Exception as e:
        logger.error(f"❌ Error checking yt-dlp: {e}")
        return False

def check_ffmpeg():
    """Check if ffmpeg is installed"""
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        logger.info(f"✅ ffmpeg found at: {ffmpeg_path}")
        return True
    else:
        logger.warning("⚠️ ffmpeg not found - some formats may not work")
        return False

# =========================================================
# HELPER FUNCTIONS
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
    """Return environment with SSL certificate vars"""
    env = os.environ.copy()
    env["SSL_CERT_FILE"] = certifi.where()
    env["REQUESTS_CA_BUNDLE"] = certifi.where()
    return env

def get_video_info(url: str) -> dict:
    """Get video information without downloading, with anti-bot measures"""
    try:
        cmd = [
            sys.executable,
            "-m",
            "yt_dlp",
            "--dump-json",
            "--extractor-args", "youtube:player_client=android,web",
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "--extractor-retries", "5",
            "--retries", "5",
            "--sleep-requests", "1",
            "--sleep-interval", "5",
            "--max-sleep-interval", "10",
            "--no-playlist",
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
                if f.get("vcodec") != "none"
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
        error_msg = f"yt-dlp error: {e.stderr}"
        if "Sign in to confirm you're not a bot" in e.stderr:
            error_msg = "YouTube requires authentication. Please provide cookies from a logged-in session."
        return {"error": error_msg}
    except Exception as e:
        return {"error": str(e)}

def parse_progress(line):
    """Parse progress from yt-dlp output"""
    import re
    
    # Percentage
    percent_match = re.search(r'(\d+(?:\.\d+)?)%', line)
    percent = float(percent_match.group(1)) if percent_match else 0
    
    # Speed
    speed_match = re.search(r'at\s+([\d.]+[KMG]?i?B/s)', line)
    speed = speed_match.group(1) if speed_match else ""
    
    # ETA
    eta_match = re.search(r'ETA\s+(\d+:\d+)', line)
    eta = eta_match.group(1) if eta_match else ""
    
    # Size
    size_match = re.search(r'of\s+~?([\d.]+[KMG]?i?B)', line)
    size = size_match.group(1) if size_match else ""
    
    return {
        "percent": percent,
        "speed": speed,
        "eta": eta,
        "size": size,
        "raw": line
    }

# =========================================================
# DOWNLOAD WORKER
# =========================================================

def download_worker(download_id, url, output_template, format_spec, cookies_file=None):
    """Background thread for downloading with improved error capture"""
    
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--no-playlist",
        "--no-check-certificate",
        "--extractor-args", "youtube:player_client=android,web",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--extractor-retries", "5",
        "--retries", "5",
        "--sleep-requests", "1",
        "--sleep-interval", "5",
        "--max-sleep-interval", "10",
        "--newline",
        "--progress",
        "-o",
        output_template,
        "-f",
        format_spec,
        url,
    ]

    # Handle cookies
    temp_cookies_path = None
    if cookies_file and cookies_file.strip():
        if os.path.exists(cookies_file):
            cmd.extend(["--cookies", cookies_file])
        else:
            temp_cookies_path = os.path.join('/tmp', f'cookies_{download_id}.txt')
            try:
                with open(temp_cookies_path, 'w') as f:
                    f.write(cookies_file)
                cmd.extend(["--cookies", temp_cookies_path])
            except Exception as e:
                logger.error(f"Failed to write cookies: {e}")

    # Add ffmpeg if available
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        cmd.extend(["--ffmpeg-location", ffmpeg_path])

    with downloads_lock:
        downloads[download_id]["status"] = "downloading"
        downloads[download_id]["start_time"] = time.time()

    proc_env = get_ssl_env()
    output_lines = []  # keep last 20 lines for error diagnosis

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

            # Store rolling window of output
            output_lines.append(line)
            if len(output_lines) > 20:
                output_lines.pop(0)

            progress = parse_progress(line)
            
            with downloads_lock:
                downloads[download_id].update({
                    "percent": progress["percent"],
                    "last_line": line,
                    "speed": progress["speed"],
                    "eta": progress["eta"],
                    "size": progress["size"]
                })

            # Emit progress
            try:
                socketio.emit(
                    "progress",
                    {
                        "id": download_id,
                        "line": line,
                        "percent": progress["percent"],
                        "speed": progress["speed"],
                        "eta": progress["eta"],
                        "size": progress["size"]
                    },
                    room=download_id,
                )
            except Exception as e:
                logger.error(f"Socket emit error: {e}")

        process.wait()

        if process.returncode == 0:
            with downloads_lock:
                downloads[download_id].update({
                    "status": "completed",
                    "end_time": time.time(),
                    "percent": 100
                })

                # Find downloaded file
                base_name = os.path.splitext(os.path.basename(output_template))[0]
                for file in os.listdir(DOWNLOAD_FOLDER):
                    if file.startswith(base_name):
                        file_path = os.path.join(DOWNLOAD_FOLDER, file)
                        downloads[download_id].update({
                            "filename": file,
                            "file_size": os.path.getsize(file_path),
                            "file_size_hr": format_size(os.path.getsize(file_path))
                        })
                        break

            socketio.emit("completed", {
                "id": download_id,
                "filename": downloads[download_id].get("filename"),
                "title": downloads[download_id].get("title")
            }, room=download_id)
            socketio.emit("files_updated", broadcast=True)
            
        else:
            # Extract meaningful error from output lines
            error_msg = f"Process exited with code {process.returncode}"
            for line in reversed(output_lines):
                if "ERROR:" in line or "Sign in" in line or "bot" in line.lower():
                    error_msg = line
                    break
            with downloads_lock:
                downloads[download_id].update({
                    "status": "failed",
                    "error": error_msg
                })
            
            socketio.emit("failed", {
                "id": download_id,
                "error": error_msg
            }, room=download_id)

    except Exception as e:
        logger.error(f"Download worker error: {e}")
        error_msg = str(e)
        with downloads_lock:
            downloads[download_id].update({
                "status": "failed",
                "error": error_msg
            })
        
        socketio.emit("failed", {
            "id": download_id,
            "error": error_msg
        }, room=download_id)
    
    finally:
        # Cleanup
        with downloads_lock:
            if download_id in active_threads:
                del active_threads[download_id]
        
        if temp_cookies_path and os.path.exists(temp_cookies_path):
            try:
                os.remove(temp_cookies_path)
            except:
                pass

# =========================================================
# ROUTES
# =========================================================

@app.route("/")
def index():
    """Main page"""
    try:
        return render_template("index.html")
    except Exception as e:
        logger.error(f"Template error: {e}")
        return jsonify({"error": "Template not found"}), 500

@app.route("/health")
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    })

@app.route("/start_download", methods=["POST"])
@rate_limit()
def start_download():
    """Start a download with better error feedback"""
    url = request.form.get("url")
    format_spec = request.form.get("format", "best")
    cookies = request.form.get("cookies", "")
    
    if not url:
        return jsonify({"error": "URL is required"}), 400
    
    # Check concurrent downloads
    with downloads_lock:
        active_count = sum(1 for d in downloads.values() 
                          if d["status"] in ("queued", "downloading"))
        if active_count >= Config.MAX_CONCURRENT_DOWNLOADS:
            return jsonify({
                "error": f"Maximum concurrent downloads reached ({Config.MAX_CONCURRENT_DOWNLOADS})"
            }), 429
    
    download_id = str(uuid.uuid4())
    
    # Get video info (may contain error, but we still allow download attempt)
    info = get_video_info(url)
    if info and "error" not in info:
        title = info.get("title", f"video_{download_id[:8]}")
    else:
        title = f"video_{download_id[:8]}"
        if info and "error" in info:
            logger.warning(f"Info error for {url}: {info['error']}")
    
    safe_title = safe_filename(title)
    output_template = os.path.join(DOWNLOAD_FOLDER, f"{safe_title}.%(ext)s")
    
    # Store download info
    with downloads_lock:
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
            "ip": request.remote_addr,
            "info_error": info.get("error") if info and "error" in info else None
        }
    
    # Start download thread
    thread = threading.Thread(
        target=download_worker,
        args=(download_id, url, output_template, format_spec, cookies),
        daemon=True,
    )
    thread.start()
    
    with downloads_lock:
        active_threads[download_id] = thread
    
    return jsonify({
        "download_id": download_id,
        "title": title,
        "status": "queued",
        "warning": info.get("error") if info and "error" in info else None
    })

@app.route("/status/<download_id>")
def get_status(download_id):
    """Get download status"""
    with downloads_lock:
        download = downloads.get(download_id, {})
        # Don't send internal data
        safe_download = {
            "id": download.get("id"),
            "title": download.get("title"),
            "status": download.get("status"),
            "percent": download.get("percent"),
            "speed": download.get("speed"),
            "eta": download.get("eta"),
            "size": download.get("size"),
            "filename": download.get("filename"),
            "file_size_hr": download.get("file_size_hr"),
            "error": download.get("error")
        }
    return jsonify(safe_download)

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
        logger.error(f"Error listing files: {e}")
        return jsonify({"error": "Failed to list files"}), 500
    
    return jsonify(files)

@app.route("/downloads/<path:filename>")
def download_file(filename):
    """Serve downloaded file"""
    try:
        return send_from_directory(
            DOWNLOAD_FOLDER, 
            filename, 
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        logger.error(f"Download error: {e}")
        return jsonify({"error": "File not found"}), 404

@app.route("/delete/<path:filename>", methods=["DELETE"])
def delete_file(filename):
    """Delete a downloaded file"""
    try:
        filepath = os.path.join(DOWNLOAD_FOLDER, filename)
        
        # Security check
        if not os.path.abspath(filepath).startswith(os.path.abspath(DOWNLOAD_FOLDER)):
            return jsonify({"error": "Invalid filename"}), 400
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            os.remove(filepath)
            socketio.emit("files_updated", broadcast=True)
            logger.info(f"Deleted file: {filename}")
            return jsonify({"success": True})
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        logger.error(f"Delete error: {e}")
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
        
        with downloads_lock:
            active_count = sum(1 for d in downloads.values() 
                              if d["status"] in ("queued", "downloading"))
        
        return jsonify({
            "file_count": len(files),
            "total_size": total_size,
            "total_size_hr": format_size(total_size),
            "active_downloads": active_count,
            "max_concurrent": Config.MAX_CONCURRENT_DOWNLOADS
        })
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/cancel/<download_id>", methods=["POST"])
def cancel_download(download_id):
    """Cancel an ongoing download"""
    with downloads_lock:
        if download_id in downloads:
            if downloads[download_id]["status"] in ("queued", "downloading"):
                downloads[download_id]["status"] = "cancelled"
                socketio.emit("cancelled", {"id": download_id}, room=download_id)
                logger.info(f"Cancelled download: {download_id}")
                return jsonify({"success": True})
    
    return jsonify({"error": "Download not found"}), 404

# =========================================================
# SOCKET.IO EVENTS
# =========================================================

@socketio.on("connect")
def on_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")

@socketio.on("disconnect")
def on_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on("subscribe")
def on_subscribe(data):
    """Subscribe to download updates"""
    download_id = data.get("download_id")
    if download_id:
        join_room(download_id)
        emit("subscribed", {"id": download_id})
        logger.info(f"Client {request.sid} subscribed to {download_id}")

# =========================================================
# CLEANUP THREAD
# =========================================================

def cleanup_old_files():
    """Clean up files older than retention period"""
    try:
        current_time = time.time()
        cutoff = current_time - (Config.FILE_RETENTION_HOURS * 3600)
        
        for filename in os.listdir(DOWNLOAD_FOLDER):
            filepath = os.path.join(DOWNLOAD_FOLDER, filename)
            if os.path.isfile(filepath):
                mtime = os.path.getmtime(filepath)
                if mtime < cutoff:
                    os.remove(filepath)
                    logger.info(f"Cleaned up old file: {filename}")
    except Exception as e:
        logger.error(f"Cleanup error: {e}")

def cleanup_thread():
    """Background thread for cleanup"""
    while True:
        time.sleep(Config.CLEANUP_INTERVAL)
        cleanup_old_files()
        
        # Clean up old download records
        with downloads_lock:
            current_time = time.time()
            to_delete = []
            for did, d in downloads.items():
                if d["status"] in ("completed", "failed", "cancelled"):
                    if current_time - d.get("end_time", current_time) > 3600:
                        to_delete.append(did)
            for did in to_delete:
                del downloads[did]

# =========================================================
# INITIALIZATION
# =========================================================

logger.info("=" * 50)
logger.info("🚀 Starting Video Downloader (Production)")
logger.info("=" * 50)

# Check dependencies
check_yt_dlp()
check_ffmpeg()

# Log paths
logger.info(f"📁 Root directory: {ROOT_DIR}")
logger.info(f"📁 Templates directory: {TEMPLATES_DIR}")
logger.info(f"📁 Downloads directory: {DOWNLOAD_FOLDER}")
logger.info(f"📁 Template exists: {os.path.exists(os.path.join(TEMPLATES_DIR, 'index.html'))}")

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_thread, daemon=True)
cleanup_thread.start()

logger.info("=" * 50)

# =========================================================
# ERROR HANDLERS
# =========================================================

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {error}")
    return jsonify({"error": "Internal server error"}), 500

# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    
    logger.info(f"🌐 Starting server on port {port}")
    logger.info(f"🐛 Debug mode: {debug}")
    
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=debug,
        allow_unsafe_werkzeug=True
    )