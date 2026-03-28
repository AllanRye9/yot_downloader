# YOT Downloader – Flutter App

A cross-platform mobile application (Android & iOS) that mirrors every feature of the YOT Downloader web frontend and connects to the same **FastAPI backend**.

## Features

| Feature | Description |
|---------|-------------|
| 🎥 **Video Downloader** | Enter any URL, preview video metadata (title, thumbnail, duration, view count), choose quality/format, and start downloading |
| 📁 **File Manager** | Browse downloaded files, open/stream them, delete individually, or batch-download a ZIP |
| 📄 **CV Generator** | Multi-step wizard to build a professional PDF CV; 8 visual themes; optional logo upload; extract fields from an existing PDF/DOCX |
| 🔄 **Document Converter** | Convert between PDF, Word, Excel, PowerPoint, JPEG, and PNG |
| ⭐ **Reviews** | Read user reviews and submit your own star rating + comment |
| ⬇ **Active Downloads** | Real-time progress bar for all running downloads; cancel individual jobs |
| ✈️ **Airport Pickup Service** | Book airport pickups with auto-calculated fares, verified driver badges, real-time map tracking, and auto-response booking prompts |

## Architecture

> **Flutter directory updated — airport pickup logic isolated in `/features/ride_sharing/airport_pickup`.**

```
flutter_app/lib/
├── main.dart                    # App entry point, theme, Provider setup
├── config/
│   └── app_config.dart          # Backend base URL (persisted via SharedPreferences)
├── models/                      # Plain Dart data classes
│   ├── video_info.dart
│   ├── download_status.dart
│   ├── file_item.dart
│   └── review.dart
├── services/
│   └── api_service.dart         # Singleton HTTP client for all FastAPI endpoints
├── providers/
│   └── downloads_provider.dart  # ChangeNotifier – polls /status/{id} every second
├── screens/                     # 6 feature screens
│   ├── home_screen.dart         # Bottom-nav shell + Settings dialog
│   ├── downloader_screen.dart   # URL → video info → format select → download
│   ├── files_screen.dart        # Files list with checkboxes and ZIP download
│   ├── cv_generator_screen.dart # 7-step CV wizard
│   ├── doc_converter_screen.dart# File picker → target format → convert
│   ├── reviews_screen.dart      # Review list + submit form
│   └── ride_share_screen.dart   # Airport pickup service screen
├── widgets/                     # Reusable UI components
│   ├── download_progress_card.dart
│   ├── video_info_card.dart
│   └── active_downloads_bar.dart
├── features/
│   └── ride_sharing/            # Airport pickup feature modules
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
    ├── widgets/                           # Shared reusable UI components
    ├── services/                          # Shared API/socket service layer
    └── models/                            # Shared data models
```

## Getting Started

### Prerequisites

- [Flutter SDK ≥ 3.19.0](https://docs.flutter.dev/get-started/install)
- Dart SDK ≥ 3.3.0 (bundled with Flutter)
- A running YOT Downloader FastAPI backend (see root `README.md`)

### Setup

```bash
# 1. Enter the flutter_app directory
cd flutter_app

# 2. Install dependencies
flutter pub get

# 3. Configure the backend URL
#    The default is http://localhost:8000.
#    You can change it in-app via Settings (⚙ icon) or edit:
#    lib/config/app_config.dart → defaultBaseUrl
```

### Run on Android Emulator / Device

```bash
# Start your emulator or connect a device, then:
flutter run

# For Android emulator the local backend is reachable at 10.0.2.2:8000
# Update Settings → Backend URL to http://10.0.2.2:8000
```

### Run on iOS Simulator

```bash
open -a Simulator
flutter run
```

### Build release APK

```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### Run tests

```bash
flutter test
```

## Configuration

Open the app, tap the **⚙ Settings** icon in the top-right corner, and set the **Backend URL** to your deployed server address (e.g. `https://your-server.com`).

The setting is persisted locally via `SharedPreferences`.

## Backend API Endpoints Used

| Screen | Method | Endpoint |
|--------|--------|----------|
| Downloader | POST | `/video_info` |
| Downloader | POST | `/start_download` |
| Downloader | GET | `/status/{id}` |
| Downloader | POST | `/cancel/{id}` |
| Files | GET | `/files` |
| Files | DELETE | `/delete/{filename}` |
| Files | GET | `/downloads/{filename}` |
| Files | POST | `/download_zip` |
| CV Generator | POST | `/api/cv/generate` |
| CV Generator | POST | `/api/cv/extract` |
| Doc Converter | POST | `/api/doc/convert` |
| Reviews | GET | `/reviews` |
| Reviews | GET | `/reviews/can_submit` |
| Reviews | POST | `/reviews` |
| Airport Pickup | GET | `/api/rides/list` |
| Airport Pickup | POST | `/api/rides/post` |
| Airport Pickup | GET | `/api/rides/calculate_fare` |
| Driver Tracking | POST | `/api/driver/location` |
| Driver Tracking | GET | `/api/driver/locations` |

## Notes

- **HTTP on Android**: The `network_security_config.xml` permits cleartext traffic to `localhost`, `10.0.2.2`, and `127.0.0.1`. For production deployments over HTTPS, no extra configuration is needed.
- **iOS**: Add the backend domain to `Info.plist` under `NSAppTransportSecurity` if using HTTP in production (not recommended).
- **File saving**: Converted and generated files are saved to the system temp directory and opened with the platform's default app. For persistent saving, integrate a file management plugin (e.g. `path_provider` + `permission_handler`).
- **Location permissions**: The `geolocator` package requires `ACCESS_FINE_LOCATION` on Android and `NSLocationWhenInUseUsageDescription` on iOS. Add these to `AndroidManifest.xml` and `Info.plist` respectively before enabling live driver tracking.
- **WebSocket**: Real-time driver location updates use `web_socket_channel`. The connection is managed by `RealtimeLocation` in `/features/ride_sharing/driver_tracking/realtime_location.dart`.
- **Map**: The `flutter_map` + `latlong2` packages provide the OpenStreetMap integration equivalent to the Leaflet map in the web frontend. Tile configuration is handled in `ScrollableMap` (`/features/ride_sharing/map/scrollable_map.dart`).
