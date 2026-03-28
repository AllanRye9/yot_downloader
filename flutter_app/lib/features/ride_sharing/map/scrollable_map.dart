import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

/// A scrollable, interactive map widget for the airport pickup service.
///
/// Renders a placeholder container in the Flutter app and is designed to
/// host a WebView or flutter_map widget pointing at the same
/// OpenStreetMap/CartoDB tile layer used by the web frontend.
///
/// Driver markers and the user's location are overlaid as [Stack] children
/// so they remain in sync with the map viewport as the user scrolls.
class ScrollableMap extends StatefulWidget {
  /// Verified driver locations to display on the map.
  final List<DriverLocation> drivers;

  /// Current user location (nullable when location permission is denied).
  final LatLng? userLocation;

  /// Callback fired when the user taps a driver marker.
  final void Function(DriverLocation driver)? onDriverTap;

  /// Pixel height of the map widget.
  final double height;

  const ScrollableMap({
    super.key,
    this.drivers = const [],
    this.userLocation,
    this.onDriverTap,
    this.height = 400,
  });

  @override
  State<ScrollableMap> createState() => _ScrollableMapState();
}

class _ScrollableMapState extends State<ScrollableMap> {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: Colors.blueGrey.shade900,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blueGrey.shade700),
      ),
      child: Stack(
        children: [
          // Map placeholder — replace with flutter_map or WebView integration
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.map, color: Colors.white54, size: 48),
                const SizedBox(height: 8),
                Text(
                  '🗺️ Live Driver Map',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${widget.drivers.length} verified driver'
                  '${widget.drivers.length != 1 ? 's' : ''} online',
                  style: const TextStyle(color: Colors.white54, fontSize: 13),
                ),
              ],
            ),
          ),

          // Driver count badge
          Positioned(
            bottom: 12,
            right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.blue.shade800,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '🚗 ${widget.drivers.where((d) => d.available).length}',
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Represents a verified driver's real-time position on the map.
class DriverLocation {
  final String name;
  final LatLng position;
  final bool verified;
  final bool available;
  final int seats;

  const DriverLocation({
    required this.name,
    required this.position,
    this.verified = false,
    this.available = true,
    this.seats = 4,
  });

  factory DriverLocation.fromMap(Map<String, dynamic> m) => DriverLocation(
        name: m['name'] as String? ?? 'Driver',
        position: LatLng(
          (m['lat'] as num).toDouble(),
          (m['lng'] as num).toDouble(),
        ),
        verified: m['verified'] == true,
        available: m['empty'] != false,
        seats: (m['seats'] as num?)?.toInt() ?? 4,
      );
}
