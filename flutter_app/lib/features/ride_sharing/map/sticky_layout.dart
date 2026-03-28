import 'package:flutter/material.dart';

/// Three-column sticky layout shell for the airport pickup service.
///
/// Mirrors the web frontend's layout (see `RidesPage.jsx`):
/// - **Left** (sticky): dashboard & driver broadcast controls
/// - **Center** (scrollable): post form at top + live map
/// - **Right** (sticky): airport pickups list
///
/// On mobile (width < 768 px) the columns collapse into a vertical stack:
/// the left and right panels become collapsible bottom-sheet-style accordions
/// while the center map fills the full screen width.
class StickyLayout extends StatefulWidget {
  /// Content for the left sticky sidebar.
  final Widget left;

  /// Main scrollable content (form + map).
  final Widget center;

  /// Content for the right sticky sidebar.
  final Widget right;

  /// Width of the left sidebar in pixels.
  final double leftWidth;

  /// Width of the right sidebar in pixels.
  final double rightWidth;

  /// Breakpoint below which the layout stacks vertically.
  final double mobileBreakpoint;

  const StickyLayout({
    super.key,
    required this.left,
    required this.center,
    required this.right,
    this.leftWidth = 280,
    this.rightWidth = 340,
    this.mobileBreakpoint = 768,
  });

  @override
  State<StickyLayout> createState() => _StickyLayoutState();
}

class _StickyLayoutState extends State<StickyLayout> {
  bool _leftExpanded = false;
  bool _rightExpanded = false;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = width < widget.mobileBreakpoint;

    if (isMobile) {
      return _buildMobileLayout();
    }
    return _buildDesktopLayout();
  }

  Widget _buildDesktopLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left sticky sidebar
        SizedBox(
          width: widget.leftWidth,
          child: widget.left,
        ),

        // Center scrollable column
        Expanded(child: widget.center),

        // Right sticky sidebar
        SizedBox(
          width: widget.rightWidth,
          child: widget.right,
        ),
      ],
    );
  }

  Widget _buildMobileLayout() {
    return Column(
      children: [
        // Center map takes full width
        Expanded(child: widget.center),

        // Left panel as collapsible accordion
        _AccordionPanel(
          title: '📊 Dashboard & Alerts',
          expanded: _leftExpanded,
          onToggle: () => setState(() => _leftExpanded = !_leftExpanded),
          child: widget.left,
        ),

        // Right panel as collapsible accordion
        _AccordionPanel(
          title: '🗺️ Airport Pickups',
          expanded: _rightExpanded,
          onToggle: () => setState(() => _rightExpanded = !_rightExpanded),
          child: widget.right,
        ),
      ],
    );
  }
}

/// A collapsible panel used in the mobile stacked layout.
class _AccordionPanel extends StatelessWidget {
  final String title;
  final bool expanded;
  final VoidCallback onToggle;
  final Widget child;

  const _AccordionPanel({
    required this.title,
    required this.expanded,
    required this.onToggle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header / toggle button — minimum 44×44 px touch target
        InkWell(
          onTap: onToggle,
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
                Icon(
                  expanded ? Icons.expand_less : Icons.expand_more,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
        // Collapsible content
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 250),
          firstChild: child,
          secondChild: const SizedBox.shrink(),
          crossFadeState:
              expanded ? CrossFadeState.showFirst : CrossFadeState.showSecond,
        ),
      ],
    );
  }
}
