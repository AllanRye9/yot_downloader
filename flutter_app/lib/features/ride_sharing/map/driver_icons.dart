import 'package:flutter/material.dart';
import 'scrollable_map.dart';

/// Animated map marker icon for a driver.
///
/// Renders a pulsing ring when the driver is [available] (empty car) and a
/// plain icon when occupied. Displays a verification badge overlay for
/// verified drivers.
class DriverIcon extends StatefulWidget {
  /// The driver this icon represents.
  final DriverLocation driver;

  /// Callback fired when the icon is tapped.
  final VoidCallback? onTap;

  /// Whether this driver is the currently selected / booked driver.
  final bool selected;

  const DriverIcon({
    super.key,
    required this.driver,
    this.onTap,
    this.selected = false,
  });

  @override
  State<DriverIcon> createState() => _DriverIconState();
}

class _DriverIconState extends State<DriverIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulse;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _scale = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
    );
    if (widget.driver.available) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(DriverIcon oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.driver.available && !_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    } else if (!widget.driver.available && _pulse.isAnimating) {
      _pulse.stop();
      _pulse.reset();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.selected
        ? Colors.amber
        : widget.driver.available
            ? Colors.green
            : Colors.grey;

    return GestureDetector(
      onTap: widget.onTap,
      child: Tooltip(
        message: '${widget.driver.name}'
            '${widget.driver.verified ? ' ✓' : ''}'
            ' — ${widget.driver.available ? '${widget.driver.seats} seats' : 'Occupied'}',
        child: ScaleTransition(
          scale: widget.driver.available ? _scale : const AlwaysStoppedAnimation(1.0),
          child: Stack(
            alignment: Alignment.topRight,
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withAlpha(200),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: widget.selected ? Colors.amber.shade800 : color.withAlpha(255),
                    width: widget.selected ? 2.5 : 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: color.withAlpha(100),
                      blurRadius: 6,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Center(
                  child: Text('🚗', style: TextStyle(fontSize: 18)),
                ),
              ),
              if (widget.driver.verified)
                Positioned(
                  top: -4,
                  right: -4,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      color: Colors.blue.shade700,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: const Center(
                      child: Icon(Icons.check, color: Colors.white, size: 10),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
