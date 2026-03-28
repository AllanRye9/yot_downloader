import 'package:flutter/material.dart';

/// A compact verification badge widget displayed on driver profiles and
/// map markers.
///
/// Shows a blue ✓ checkmark when [verified] is `true`, and is invisible
/// (zero-size) otherwise so it can be dropped inline anywhere without
/// affecting layout when the driver is not yet verified.
class VerificationBadge extends StatelessWidget {
  /// Whether the driver has been verified by an admin.
  final bool verified;

  /// Size of the badge icon. Defaults to 16 logical pixels.
  final double size;

  /// Tooltip text shown on long-press / hover.
  final String tooltip;

  const VerificationBadge({
    super.key,
    required this.verified,
    this.size = 16,
    this.tooltip = 'Verified driver',
  });

  @override
  Widget build(BuildContext context) {
    if (!verified) return const SizedBox.shrink();
    return Tooltip(
      message: tooltip,
      child: Icon(
        Icons.verified,
        color: Colors.blue.shade600,
        size: size,
        semanticLabel: tooltip,
      ),
    );
  }
}

/// A driver list-tile that prominently displays the verification badge
/// next to the driver's name.
class DriverBadgeTile extends StatelessWidget {
  final String name;
  final bool verified;
  final String? subtitle;
  final VoidCallback? onBook;

  const DriverBadgeTile({
    super.key,
    required this.name,
    required this.verified,
    this.subtitle,
    this.onBook,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: verified ? Colors.blue.shade700 : Colors.grey,
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(color: Colors.white),
        ),
      ),
      title: Row(
        children: [
          Flexible(
            child: Text(
              name,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 6),
          VerificationBadge(verified: verified),
        ],
      ),
      subtitle: subtitle != null ? Text(subtitle!) : null,
      trailing: onBook != null
          ? ElevatedButton(
              onPressed: onBook,
              style: ElevatedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              ),
              child: const Text('Book'),
            )
          : null,
    );
  }
}
