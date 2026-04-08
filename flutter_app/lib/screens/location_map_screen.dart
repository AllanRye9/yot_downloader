import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

/// Full-screen map that shows the device's current GPS position.
///
/// Displays a flutter_map centred on the user's location with a marker.
/// The [onShareLocation] callback is invoked when the user taps "Share Location",
/// passing the lat/lng and a human-readable label.
///
/// If [readOnly] is true the share button is hidden (e.g. for viewing a
/// received location).  [initialLat]/[initialLng] pre-set the map centre when
/// provided (e.g. when viewing a shared location from a message).
class LocationMapScreen extends StatefulWidget {
  final void Function(double lat, double lng, String label)? onShareLocation;
  final double? initialLat;
  final double? initialLng;
  final String? initialLabel;
  final bool readOnly;

  const LocationMapScreen({
    super.key,
    this.onShareLocation,
    this.initialLat,
    this.initialLng,
    this.initialLabel,
    this.readOnly = false,
  });

  @override
  State<LocationMapScreen> createState() => _LocationMapScreenState();
}

class _LocationMapScreenState extends State<LocationMapScreen> {
  final MapController _mapCtrl = MapController();

  Position? _position;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initialLat != null && widget.initialLng != null) {
      _loading = false;
    } else {
      _fetchLocation();
    }
  }

  Future<void> _fetchLocation() async {
    setState(() { _loading = true; _error = null; });
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() { _error = 'Location services are disabled. Please enable them in Settings.'; _loading = false; });
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() { _error = 'Location permission denied.'; _loading = false; });
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _error = 'Location permission permanently denied. Please enable it in App Settings.';
          _loading = false;
        });
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      if (mounted) {
        setState(() { _position = pos; _loading = false; });
        _mapCtrl.move(LatLng(pos.latitude, pos.longitude), 15);
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  double get _lat => _position?.latitude ?? widget.initialLat ?? 0;
  double get _lng => _position?.longitude ?? widget.initialLng ?? 0;

  String get _label =>
      widget.initialLabel ?? '${_lat.toStringAsFixed(5)}, ${_lng.toStringAsFixed(5)}';

  Future<void> _openInMaps() async {
    final uri = Uri.parse('https://maps.google.com/?q=$_lat,$_lng');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.readOnly ? 'Shared Location' : 'Your Location'),
        actions: [
          IconButton(
            icon: const Icon(Icons.open_in_new),
            tooltip: 'Open in Maps',
            onPressed: (_loading || _error != null) ? null : _openInMaps,
          ),
          if (!widget.readOnly)
            IconButton(
              icon: const Icon(Icons.my_location),
              tooltip: 'Refresh Location',
              onPressed: _fetchLocation,
            ),
        ],
      ),
      body: _loading
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 12),
                  Text('Getting your location…'),
                ],
              ),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.location_off, size: 48, color: Colors.red),
                        const SizedBox(height: 12),
                        Text(_error!, textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                          onPressed: _fetchLocation,
                        ),
                      ],
                    ),
                  ),
                )
              : Stack(
                  children: [
                    FlutterMap(
                      mapController: _mapCtrl,
                      options: MapOptions(
                        initialCenter: LatLng(_lat, _lng),
                        initialZoom: 15,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.yot.downloader',
                        ),
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: LatLng(_lat, _lng),
                              width: 48,
                              height: 48,
                              child: const Icon(
                                Icons.location_pin,
                                color: Colors.red,
                                size: 48,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    // Coordinates label
                    Positioned(
                      bottom: 80,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.65),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            _label,
                            style: const TextStyle(
                                color: Colors.white, fontSize: 12),
                          ),
                        ),
                      ),
                    ),
                    // Share button (only shown if not read-only and callback provided)
                    if (!widget.readOnly && widget.onShareLocation != null)
                      Positioned(
                        bottom: 20,
                        left: 20,
                        right: 20,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            backgroundColor: Colors.green.shade700,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                          ),
                          icon: const Icon(Icons.share_location),
                          label: const Text('Share This Location',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.bold)),
                          onPressed: () {
                            widget.onShareLocation!(_lat, _lng, _label);
                            Navigator.pop(context);
                          },
                        ),
                      ),
                  ],
                ),
    );
  }
}
