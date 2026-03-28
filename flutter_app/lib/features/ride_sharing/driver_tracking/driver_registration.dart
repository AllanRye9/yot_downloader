import 'package:flutter/material.dart';
import '../../../services/api_service.dart';

/// Driver registration screen for the airport pickup service.
///
/// Drivers complete this form before they can post their location or
/// accept bookings. All fields are mandatory; document upload is required
/// for admin verification.
class DriverRegistrationScreen extends StatefulWidget {
  const DriverRegistrationScreen({super.key});

  @override
  State<DriverRegistrationScreen> createState() =>
      _DriverRegistrationScreenState();
}

class _DriverRegistrationScreenState extends State<DriverRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _vehicleCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  final _seatsCtrl = TextEditingController(text: '4');
  bool _submitting = false;
  String? _error;
  bool _submitted = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _vehicleCtrl.dispose();
    _plateCtrl.dispose();
    _seatsCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ApiService.instance.registerDriver(
        name: _nameCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        vehicle: _vehicleCtrl.text.trim(),
        plate: _plateCtrl.text.trim(),
        seats: int.tryParse(_seatsCtrl.text.trim()) ?? 4,
      );
      setState(() => _submitted = true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_submitted) {
      return Scaffold(
        appBar: AppBar(title: const Text('Driver Registration')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle, color: Colors.green, size: 64),
                SizedBox(height: 16),
                Text(
                  'Registration submitted!',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 8),
                Text(
                  'Your application is under review. You will receive a '
                  'verification badge once an admin approves your account.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Driver Registration')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Complete your registration to accept airport pickups. '
                'All fields are required. Your application will be reviewed '
                'by an admin before you receive a verification badge.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 20),
              _field(
                controller: _nameCtrl,
                label: 'Full Name',
                icon: Icons.person,
                validator: (v) =>
                    (v?.trim().isEmpty ?? true) ? 'Name is required' : null,
              ),
              const SizedBox(height: 12),
              _field(
                controller: _phoneCtrl,
                label: 'Phone / WhatsApp',
                icon: Icons.phone,
                keyboard: TextInputType.phone,
                validator: (v) =>
                    (v?.trim().isEmpty ?? true) ? 'Phone is required' : null,
              ),
              const SizedBox(height: 12),
              _field(
                controller: _vehicleCtrl,
                label: 'Vehicle Make & Model',
                icon: Icons.directions_car,
                validator: (v) =>
                    (v?.trim().isEmpty ?? true) ? 'Vehicle is required' : null,
              ),
              const SizedBox(height: 12),
              _field(
                controller: _plateCtrl,
                label: 'Plate Number',
                icon: Icons.credit_card,
                validator: (v) =>
                    (v?.trim().isEmpty ?? true) ? 'Plate is required' : null,
              ),
              const SizedBox(height: 12),
              _field(
                controller: _seatsCtrl,
                label: 'Available Seats',
                icon: Icons.event_seat,
                keyboard: TextInputType.number,
                validator: (v) {
                  final n = int.tryParse(v?.trim() ?? '');
                  if (n == null || n < 1 || n > 20) {
                    return 'Enter a valid seat count (1–20)';
                  }
                  return null;
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
                label: const Text('Submit Registration'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboard,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboard,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: const OutlineInputBorder(),
      ),
      validator: validator,
    );
  }
}
