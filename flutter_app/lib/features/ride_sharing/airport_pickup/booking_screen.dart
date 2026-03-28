import 'package:flutter/material.dart';
import '../../../services/api_service.dart';
import 'fare_calculator.dart';
import 'auto_response_service.dart';

/// Airport pickup booking screen.
///
/// Clients select an airport, enter their destination, and the system
/// auto-calculates the fare before presenting the nearest verified drivers.
class BookingScreen extends StatefulWidget {
  const BookingScreen({super.key});

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  final _airportController = TextEditingController();
  final _destinationController = TextEditingController();
  bool _loading = false;
  String? _error;
  double? _fare;
  List<Map<String, dynamic>> _drivers = [];

  @override
  void dispose() {
    _airportController.dispose();
    _destinationController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final airport = _airportController.text.trim();
    final destination = _destinationController.text.trim();
    if (airport.isEmpty || destination.isEmpty) {
      setState(() => _error = 'Please enter both airport and destination.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _fare = null;
      _drivers = [];
    });
    try {
      final result = await ApiService.instance.searchAirportPickup(
        airport: airport,
        destination: destination,
      );
      final calculatedFare = FareCalculator.fromApiResult(result);
      setState(() {
        _fare = calculatedFare;
        _drivers = List<Map<String, dynamic>>.from(result['drivers'] ?? []);
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _book(Map<String, dynamic> driver) async {
    final autoMsg = AutoResponseService.bookingPrompt(
      driverName: driver['name'] as String? ?? 'Driver',
    );
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Book ${driver['name'] ?? 'Driver'}'),
        content: Text(autoMsg),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Booking request sent!')),
              );
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('✈️ Airport Pickup')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _airportController,
              decoration: const InputDecoration(
                labelText: 'Airport',
                hintText: 'e.g. Nairobi JKIA',
                prefixIcon: Icon(Icons.flight_land),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _destinationController,
              decoration: const InputDecoration(
                labelText: 'Destination',
                hintText: 'e.g. Westlands, Nairobi',
                prefixIcon: Icon(Icons.location_on),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loading ? null : _search,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.search),
              label: const Text('Find Drivers'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            if (_fare != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  border: Border.all(color: Colors.green.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Estimated fare: \$${_fare!.toStringAsFixed(2)}',
                  style: TextStyle(
                    color: Colors.green.shade800,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Expanded(
              child: _drivers.isEmpty && !_loading
                  ? const Center(
                      child: Text(
                        'Enter your airport and destination to find drivers.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                    )
                  : ListView.builder(
                      itemCount: _drivers.length,
                      itemBuilder: (context, index) {
                        final driver = _drivers[index];
                        final verified = driver['verified'] == true;
                        return Card(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  verified ? Colors.blue : Colors.grey,
                              child: Text(
                                (driver['name'] as String? ?? '?')
                                    .characters
                                    .first
                                    .toUpperCase(),
                                style: const TextStyle(color: Colors.white),
                              ),
                            ),
                            title: Row(
                              children: [
                                Text(driver['name'] as String? ?? 'Driver'),
                                if (verified) ...[
                                  const SizedBox(width: 6),
                                  const Icon(Icons.verified,
                                      color: Colors.blue, size: 16),
                                ],
                              ],
                            ),
                            subtitle: Text(
                              driver['distance_km'] != null
                                  ? '${(driver['distance_km'] as num).toStringAsFixed(1)} km away'
                                  : 'Distance unknown',
                            ),
                            trailing: ElevatedButton(
                              onPressed: () => _book(driver),
                              child: const Text('Book'),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
