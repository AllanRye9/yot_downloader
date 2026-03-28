import 'dart:math';

/// Distance-based fare calculator using the Haversine formula.
///
/// Computes the fare between two geographic coordinates using the
/// configured rate per kilometre.
class FareCalculator {
  /// Default fare rate in USD per kilometre, matching the `FARE_PER_KM`
  /// server-side environment variable (default `1.5`).
  static const double defaultRatePerKm = 1.5;

  /// Earth's mean radius in kilometres.
  static const double _earthRadiusKm = 6371.0;

  /// Calculates the great-circle distance (km) between two coordinates.
  static double distanceKm(
    double originLat,
    double originLng,
    double destLat,
    double destLng,
  ) {
    final dLat = _toRad(destLat - originLat);
    final dLng = _toRad(destLng - originLng);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRad(originLat)) *
            cos(_toRad(destLat)) *
            sin(dLng / 2) *
            sin(dLng / 2);
    return _earthRadiusKm * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  /// Calculates the fare for a trip.
  ///
  /// [ratePerKm] defaults to [defaultRatePerKm] if not supplied.
  static double calculate({
    required double originLat,
    required double originLng,
    required double destLat,
    required double destLng,
    double ratePerKm = defaultRatePerKm,
  }) {
    final km = distanceKm(originLat, originLng, destLat, destLng);
    return km * ratePerKm;
  }

  /// Extracts a pre-calculated fare from an API result map.
  ///
  /// Falls back to client-side calculation when coordinates are available
  /// but the `fare` field is absent.
  static double? fromApiResult(Map<String, dynamic> result) {
    if (result['fare'] != null) {
      return (result['fare'] as num).toDouble();
    }
    final oLat = _asDouble(result['origin_lat']);
    final oLng = _asDouble(result['origin_lng']);
    final dLat = _asDouble(result['dest_lat']);
    final dLng = _asDouble(result['dest_lng']);
    if (oLat != null && oLng != null && dLat != null && dLng != null) {
      return calculate(
        originLat: oLat,
        originLng: oLng,
        destLat: dLat,
        destLng: dLng,
      );
    }
    return null;
  }

  static double _toRad(double deg) => deg * pi / 180;

  static double? _asDouble(dynamic v) {
    if (v == null) return null;
    return (v as num).toDouble();
  }
}
