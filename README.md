# yot_downloader — Airport Pickup Platform

<p align="center">
  <img src="https://github.com/user-attachments/assets/e5663d6c-8ee6-4439-a3db-d08c407dfadf" alt="yot_downloader logo" width="180"/>
</p>

<p align="center">
  This platform bridges airport travelers with verified drivers through intelligent matching, real-time tracking, and transparent fare calculation. Built for reliability, trust, and seamless mobile experience.
</p>

---

## Overview

Book an airport pickup in seconds: clients select their airport and destination, the system auto-calculates the fare, and the nearest verified driver is matched instantly. Every driver is registered, reviewed, and marked with a verification badge before appearing on the live map. Real-time WebSocket tracking keeps clients informed as their driver moves, while an auto-response messaging flow ensures all booking details are collected without back-and-forth friction — all in a mobile-first layout that works perfectly on any device.

---

## Core Features

- **Smart Fare Engine** — Distance-based auto-calculation using the Haversine formula between the pickup airport and the client's destination. No hidden fees, no surprises — the fare is shown before booking is confirmed.
- **Verified Driver Network** — Drivers complete a registration form (personal details, vehicle info, document upload) and receive admin approval before participating. A visible ✓ verification badge appears on each approved driver's profile and map marker, building trust at a glance.
- **Real-Time Map** — An interactive OpenStreetMap view shows all verified, available drivers with animated pulse markers. Clients can see drivers moving in real time and book the nearest one directly from the map.
- **Auto-Response Messaging** — When a client sends their first booking message, the system immediately replies with a structured prompt: *"Please share your current location, full name, and contact number to complete your booking."* This collects all necessary details in one step, reducing friction for both sides.
- **Mobile-First Layout** — Sticky sidebars, a scrollable central map, and a responsive design that stacks gracefully on smaller screens. Touch targets meet the 44×44 px minimum and map interactions are optimised for fingers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Python + FastAPI + Socket.IO |
| Database | PostgreSQL (production) / SQLite (development) |
| Real-time tracking | WebSocket via Socket.IO |
| Map integration | Leaflet + OpenStreetMap (CartoDB Voyager / OSM tiles) |
| Mobile | Flutter (iOS & Android) |
| Downloader | yt-dlp + ffmpeg |

---

## Flutter Directory

> **Flutter structure reorganized — see `/lib/features/ride_sharing` for airport pickup modules, map widgets, and driver tracking logic.**

```
flutter_app/lib/
├── features/
│   └── ride_sharing/
│       ├── airport_pickup/
│       │   ├── booking_screen.dart        # Client booking flow (airport → destination)
│       │   ├── fare_calculator.dart       # Distance-based fare engine
│       │   └── auto_response_service.dart # Structured prompt auto-reply
│       ├── driver_tracking/
│       │   ├── driver_registration.dart   # Registration form + document upload
│       │   ├── verification_badge.dart    # Badge widget for verified drivers
│       │   └── realtime_location.dart     # WebSocket location broadcasting
│       └── map/
│           ├── scrollable_map.dart        # Interactive, scrollable map widget
│           ├── driver_icons.dart          # Animated driver markers with badge overlay
│           └── sticky_layout.dart         # 3-column sticky layout shell
└── shared/
    ├── widgets/                           # Reusable UI components
    ├── services/                          # Shared API/socket service layer
    └── models/                            # Shared data models
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.11+ |
| Flutter | ≥ 3.19.0 |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | latest |
| ffmpeg *(optional)* | for video merging |

### Server Setup

```bash
# 1. Clone the repository
git clone https://github.com/AllanRye9/yot_downloader.git
cd yot_downloader

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables (copy and edit as needed)
#    FARE_PER_KM=1.5          — base fare rate per km
#    MAP_API_KEY=<key>         — optional map tile API key
#    DATABASE_URL=<postgres>   — PostgreSQL connection string (omit for SQLite)
#    SECRET_KEY=<secret>       — session secret (set in production)

# 5. Start the server
python api/app.py
# → http://127.0.0.1:5000
```

### Flutter Mobile App

```bash
cd flutter_app
flutter pub get
flutter run
# Configure the backend URL via Settings (⚙) in the app
```

---

## API Reference

### Downloader

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the main UI |
| `POST` | `/start_download` | Start a download; returns `{"download_id": "..."}` |
| `GET` | `/status/<id>` | Progress for a specific download |
| `GET` | `/files` | List all downloaded files |
| `GET` | `/downloads/<filename>` | Stream a file to the browser |
| `DELETE` | `/delete/<filename>` | Delete a downloaded file |
| `POST` | `/cancel/<id>` | Cancel an in-progress download |
| `GET` | `/health` | Health check |

### Airport Pickup Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rides/calculate_fare` | Auto-calculate fare (`?origin_lat=&origin_lng=&dest_lat=&dest_lng=`) |
| `POST` | `/api/rides/post` | Post a pickup request (includes `fare`, `dest_lat`, `dest_lng`) |
| `GET` | `/api/rides/list` | List all pickup requests (includes `fare` in response) |
| `POST` | `/api/driver/location` | Broadcast driver location (verified drivers only) |
| `GET` | `/api/driver/locations` | All active verified driver locations |

### Socket.IO Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Server → Client | `progress` | yt-dlp download progress |
| Server → Client | `ride_chat_message` | New chat message (including auto-response system prompts) |
| Server → Client | `driver_nearby` | Real-time driver location update |
| Client → Server | `join_ride_chat` | Join a ride's chat room |
| Client → Server | `ride_chat_message` | Send a chat message |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | random | Flask/FastAPI session secret — set in production |
| `DOWNLOAD_FOLDER` | `downloads` | Directory for saved files |
| `ALLOWED_ORIGINS` | `*` | CORS origins — restrict in production |
| `PORT` | `5000` | Server port |
| `FARE_PER_KM` | `1.5` | Base fare rate (USD) per kilometre |
| `DATABASE_URL` | *(SQLite)* | PostgreSQL connection string |

---

## Docker

```bash
docker build -t yot_downloader .
docker run -p 5000:5000 yot_downloader
```

---

## Troubleshooting

### ❌ Bot detection / "This video cannot be downloaded right now"

YouTube may challenge automated requests. The app automatically retries with alternative player clients (`web_embedded`, `tv`, `mweb`). If retries fail, upload a `cookies.txt` file via **Admin → Cookies**.

See the [yt-dlp cookies FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp) for export instructions.

### ❌ HTTP 403 Forbidden

The downloader retries with cookieless CDN clients and falls back to `gallery-dl`, `you-get`, and `streamlink` before reporting failure. Supplying a `cookies.txt` file resolves most persistent 403 errors.

---

## Impact Statement

Designed to make airport travel effortless — one tap, verified driver, clear fare, live tracking. Travelers gain trust and transparency through driver verification badges and auto-calculated fares. Drivers receive credibility through structured onboarding and a visible verification badge. The map-first layout keeps essential actions visible while exploration stays fluid. Mobile responsiveness ensures the service works where it matters most — on the go. The Flutter directory restructuring sets a scalable foundation for future enhancements across the ride-sharing platform.

---

## License

This project is provided as-is for personal and educational use.
