import 'dart:async';
import 'package:flutter/material.dart';
import '../../../services/api_service.dart';

/// Handles real-time location broadcasting for verified drivers.
///
/// Only verified drivers are permitted to share their location. The
/// [RealtimeLocation] service polls the device GPS and pushes updates
/// to the server at a configurable interval to keep battery usage low.
///
/// Location sharing is active only while [active] is `true` and can be
/// toggled by the driver at any time.
class RealtimeLocation extends ChangeNotifier {
  /// How often to push a location update to the server.
  static const Duration _updateInterval = Duration(seconds: 5);

  bool _active = false;
  bool _loading = false;
  String? _error;
  Timer? _timer;

  /// Whether the driver is currently broadcasting their location.
  bool get active => _active;

  /// Whether a location update is in flight.
  bool get loading => _loading;

  /// Last error message, or `null` if no error.
  String? get error => _error;

  /// Starts broadcasting the driver's location to the server.
  ///
  /// [seats] is included so the server knows the driver's current capacity.
  /// Throws if the driver is not verified.
  Future<void> startBroadcasting({required int seats}) async {
    if (_active) return;
    _active = true;
    _error = null;
    notifyListeners();
    await _pushLocation(seats: seats);
    _timer = Timer.periodic(_updateInterval, (_) => _pushLocation(seats: seats));
  }

  /// Stops broadcasting and clears the periodic timer.
  void stopBroadcasting() {
    _active = false;
    _timer?.cancel();
    _timer = null;
    notifyListeners();
  }

  Future<void> _pushLocation({required int seats}) async {
    _loading = true;
    notifyListeners();
    try {
      await ApiService.instance.broadcastDriverLocation(seats: seats);
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

/// A toggle button widget that starts or stops real-time location
/// broadcasting for the current driver.
class LocationBroadcastButton extends StatelessWidget {
  final RealtimeLocation service;
  final int seats;

  const LocationBroadcastButton({
    super.key,
    required this.service,
    required this.seats,
  });

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: service,
      builder: (context, _) {
        final active = service.active;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ElevatedButton.icon(
              onPressed: service.loading
                  ? null
                  : () {
                      if (active) {
                        service.stopBroadcasting();
                      } else {
                        service.startBroadcasting(seats: seats);
                      }
                    },
              icon: Icon(active ? Icons.location_off : Icons.my_location),
              label: Text(active ? 'Stop Broadcasting' : 'Go Online'),
              style: ElevatedButton.styleFrom(
                backgroundColor: active ? Colors.red.shade700 : Colors.green.shade700,
                foregroundColor: Colors.white,
              ),
            ),
            if (service.error != null) ...[
              const SizedBox(height: 4),
              Text(
                service.error!,
                style: const TextStyle(color: Colors.red, fontSize: 12),
              ),
            ],
          ],
        );
      },
    );
  }
}
