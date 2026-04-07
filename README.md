# yotweek — Ride Share Platform

<p align="center">
  <img src="https://github.com/user-attachments/assets/e5663d6c-8ee6-4439-a3db-d08c407dfadf" alt="yotweek logo" width="180"/>
</p>

<p align="center">
  yotweek is a free ride-sharing platform with a live driver map, real-time bi-directional messaging inbox, and ride confirmation — no subscription required.
</p>

---

## Overview

yotweek makes ride sharing simple. Drivers post rides with auto-calculated fares; passengers find available drivers on a live map, book in seconds, and communicate through a real-time encrypted inbox. The journey confirmation system lets passengers confirm their booking directly inside the chat, notifying drivers instantly.

---

## Core Features

- **🚗 Ride Share** — Drivers post airport or city rides; fares are calculated automatically from origin and destination coordinates. Passengers see animated ride cards, sort by fare or departure time, and book via real-time chat.
- **📍 Live Driver Map** — Interactive map showing active drivers within your radius, updated every 15 seconds. Click a driver card to see their details, vehicle, and distance from you.
- **💬 Real-Time Messaging Inbox** — Bi-directional direct messages and ride chat threads in a single unified view. End-to-end encrypted with image, audio recording, file, and location sharing.
- **✅ Journey Confirmation** — Passengers confirm their journey directly inside the ride chat (name + contact), notifying drivers instantly. Drivers can view all confirmed passengers and send proximity alerts.
- **🔔 Real-Time Notifications** — WebSocket-powered notifications for new messages, ride updates, and driver arrival alerts, delivered without page reloads.
- **📱 Mobile-First Layout** — Responsive design that stacks gracefully on phones and tablets. Available as a Flutter app for iOS and Android.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Python + FastAPI + Socket.IO |
| Database | PostgreSQL (production) / SQLite (development) |
| Real-time | WebSocket via Socket.IO |
| Maps | Leaflet + OpenStreetMap |
| Mobile | Flutter (iOS & Android) |

---

## Flutter Directory

```
flutter_app/lib/
├── features/
│   └── ride_sharing/
│       ├── airport_pickup/
│       │   ├── booking_screen.dart        # Client booking flow (airport → destination)
│       │   ├── fare_calculator.dart       # Distance-based fare engine (Haversine)
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
| Flutter | >= 3.19.0 |

### Server Setup

```bash
# 1. Clone the repository
git clone https://github.com/AllanRye9/yotweek.git
cd yotweek

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables (copy and edit as needed)
#    FARE_PER_KM=1.0          — base fare rate per km
#    DATABASE_URL=<postgres>   — PostgreSQL connection string (omit for SQLite)
#    SECRET_KEY=<secret>       — session secret (set in production)
#    SMTP_HOST / SMTP_PORT     — email sending (optional)
#    NOMINATIM_URL             — custom Nominatim geocoder (optional)

# 5. Start the server
python api/app.py
# -> http://127.0.0.1:5000
```

### Flutter Mobile App

```bash
cd flutter_app
flutter pub get
flutter run
# Configure the backend URL via Settings in the app
```

---

## API Reference

### Ride Share

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rides/calculate_fare` | Auto-calculate fare (`?origin_lat=&origin_lng=&dest_lat=&dest_lng=`) |
| `GET` | `/api/rides/estimate_fare` | Geocode-based fare estimate (`?start=&destination=&seats=`) |
| `POST` | `/api/rides/post` | Post a ride (driver only; fare auto-calculated from coordinates) |
| `GET` | `/api/rides/list` | List all rides (includes `fare`, `per_seat_cost`, `ride_type`) |
| `POST` | `/api/rides/{id}/confirm_journey` | Passenger confirms journey (name + contact) |
| `GET` | `/api/rides/{id}/confirmed_users` | Driver: list confirmed passengers |
| `POST` | `/api/rides/{id}/proximity_notify` | Driver: send proximity alert to passengers |
| `POST` | `/api/driver/location` | Broadcast driver location (verified drivers only) |
| `GET` | `/api/driver/locations` | All active verified driver locations |

### Messaging & Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dm/conversations` | List DM conversations with last message preview (supports `?search=`) |
| `POST` | `/api/dm/conversations` | Start a new DM conversation |
| `GET` | `/api/dm/conversations/{id}/messages` | Fetch conversation history |
| `POST` | `/api/dm/messages` | Send a direct message |
| `GET` | `/api/users/{id}/profile` | Get a user's public profile (name, username, avatar) |
| `GET` | `/api/notifications` | Fetch notifications (with `unread` count) |
| `PUT` | `/api/notifications/read_all` | Mark all notifications read |

### Socket.IO Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Server to Client | `new_ride` | New ride posted (real-time) |
| Server to Client | `ride_chat_message` | New chat message in a ride room |
| Server to Client | `driver_nearby` | Driver location broadcast |
| Server to Client | `driver_arrived` | Driver arrival alert to passengers |
| Server to Client | `dm_message` | New direct message received |
| Server to Client | `dm_typing` | Other user is typing |
| Server to Client | `dm_read` | Message read receipt |
| Client to Server | `dm_join` | Join a DM conversation room |
| Client to Server | `dm_message` | Send a DM |
| Client to Server | `join_ride_chat` | Join a ride's chat room |
| Client to Server | `ride_chat_message` | Send a ride chat message |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | random | FastAPI session secret — set in production |
| `ALLOWED_ORIGINS` | `*` | CORS origins — restrict in production |
| `PORT` | `5000` | Server port |
| `FARE_PER_KM` | `1.0` | Base fare rate (USD) per kilometre |
| `DATABASE_URL` | *(SQLite)* | PostgreSQL connection string |
| `SMTP_HOST` | — | SMTP server for email notifications |
| `NOMINATIM_URL` | public OSM | Custom Nominatim geocoder URL |

---

## Docker

```bash
docker build -t yotweek .
docker run -p 5000:5000 yotweek
```

---

## Platform Sections

| Section | Route | Description |
|---------|-------|-------------|
| Home | `/` | Overview and quick access to rides and map |
| Ride Share | `/rides` | Post rides (drivers) and find available rides (passengers) |
| Live Map | `/map` | Live driver map with radius search and driver cards |
| Inbox | `/inbox` | Direct messages and ride chat threads with bi-directional real-time messaging |
| Dashboard | `/user/dashboard` or `/driver/dashboard` | Personal hub: rides, history, inbox |
| Profile | `/profile` | Account settings, avatar, location, driver status |

---

## License

This project is provided as-is for personal and educational use.
