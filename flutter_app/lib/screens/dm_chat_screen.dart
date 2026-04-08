import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'location_map_screen.dart';

/// Direct-message chat between two users.
///
/// Features:
/// - Left (received) / right (sent) message bubbles
/// - Profile picture / avatar attached to all received messages
/// - Animated typing indicator (3 bouncing dots) that appears while the
///   current user is composing a message
/// - Location sharing: opens [LocationMapScreen] and inserts a map-link
///   message into the conversation
/// - HTTP polling every 4 seconds for new messages
class DmChatScreen extends StatefulWidget {
  final Map<String, dynamic> conversation;
  final Map<String, dynamic>? currentUser;

  const DmChatScreen({super.key, required this.conversation, this.currentUser});

  @override
  State<DmChatScreen> createState() => _DmChatScreenState();
}

class _DmChatScreenState extends State<DmChatScreen>
    with TickerProviderStateMixin {
  final _textCtrl   = TextEditingController();
  final _scrollCtrl = ScrollController();

  List<Map<String, dynamic>> _messages = [];
  bool   _loading  = true;
  String? _error;
  bool   _sending  = false;
  bool   _isTyping = false;

  // Typing animation (3 bouncing dots shown while composing)
  late final List<AnimationController> _dotCtrl;
  late final List<Animation<double>>   _dotAnim;

  Timer? _pollTimer;

  Map<String, dynamic> get _conv      => widget.conversation;
  Map<String, dynamic>? get _me        => widget.currentUser;
  String get _convId    => (_conv['conv_id'] ?? '').toString();
  String get _myId      => (_me?['user_id'] ?? '').toString();
  Map<String, dynamic>  get _other     => (_conv['other_user'] as Map<String, dynamic>?) ?? {};
  String get _otherName => (_other['name'] ?? _other['username'] ?? 'User').toString();
  String? get _otherAvatar => _other['avatar_url']?.toString();

  @override
  void initState() {
    super.initState();
    _dotCtrl = List.generate(
      3,
      (i) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 350),
      ),
    );
    _dotAnim = _dotCtrl
        .map((c) => Tween<double>(begin: 0, end: -8).animate(
              CurvedAnimation(parent: c, curve: Curves.easeInOut)))
        .toList();

    _loadMessages();
    _pollTimer = Timer.periodic(
        const Duration(seconds: 4), (_) => _loadMessages(silent: true));
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    _pollTimer?.cancel();
    for (final c in _dotCtrl) c.dispose();
    super.dispose();
  }

  // ── Typing animation ──────────────────────────────────────────────────────

  void _onTextChanged(String text) {
    final typing = text.isNotEmpty;
    if (typing == _isTyping) return;
    setState(() => _isTyping = typing);
    if (typing) {
      for (int i = 0; i < 3; i++) {
        Future.delayed(Duration(milliseconds: i * 140), () {
          if (mounted) _dotCtrl[i].repeat(reverse: true);
        });
      }
    } else {
      for (final c in _dotCtrl) {
        c.stop();
        c.animateTo(0);
      }
    }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  Future<void> _loadMessages({bool silent = false}) async {
    if (_convId.isEmpty) return;
    if (!silent) setState(() { _loading = true; _error = null; });
    try {
      final msgs = await ApiService.instance.getDmMessages(_convId);
      if (!mounted) return;
      setState(() { _messages = msgs; _loading = false; });
      _scrollToBottom();
      ApiService.instance.markDmRead(_convId);
    } on ApiException catch (e) {
      if (mounted && !silent) setState(() { _error = e.message; _loading = false; });
    } catch (e) {
      if (mounted && !silent) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  Future<void> _sendText() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty || _sending || _convId.isEmpty) return;
    _textCtrl.clear();
    _onTextChanged('');
    setState(() => _sending = true);
    // Optimistic local message
    final local = <String, dynamic>{
      'msg_id':    'local-${DateTime.now().millisecondsSinceEpoch}',
      'sender_id': _myId,
      'content':   text,
      'ts':        DateTime.now().millisecondsSinceEpoch / 1000,
      '_local':    true,
    };
    setState(() => _messages.add(local));
    _scrollToBottom();
    try {
      await ApiService.instance.sendDmMessage(convId: _convId, content: text);
      // Refresh to replace local message with server version
      await _loadMessages(silent: true);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _shareLocation() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LocationMapScreen(
          onShareLocation: (lat, lng, label) async {
            final text = '📍 My location: https://maps.google.com/?q=$lat,$lng';
            try {
              await ApiService.instance.sendDmMessage(convId: _convId, content: text);
              await _loadMessages(silent: true);
            } catch (_) {}
          },
        ),
      ),
    );
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  bool _isMe(Map<String, dynamic> msg) {
    final sid = (msg['sender_id'] ?? '').toString();
    return sid.isNotEmpty && sid == _myId;
  }

  String _fmtTime(dynamic ts) {
    if (ts == null) return '';
    try {
      final num n = ts is num ? ts : double.parse(ts.toString());
      final dt = n < 1e10
          ? DateTime.fromMillisecondsSinceEpoch((n * 1000).round())
          : DateTime.fromMillisecondsSinceEpoch(n.round());
      final local = dt.toLocal();
      return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  DeliveryStatus _deliveryStatus(Map<String, dynamic> msg) {
    if (msg['_local'] == true) return DeliveryStatus.sending;
    final s = (msg['status'] ?? '').toString();
    if (s == 'read')      return DeliveryStatus.read;
    if (s == 'delivered') return DeliveryStatus.delivered;
    return DeliveryStatus.sent;
  }

  Widget _avatar(String name, String? avatarUrl, {double size = 30}) {
    if (avatarUrl != null && avatarUrl.isNotEmpty) {
      final url = ApiService.instance.avatarUrl(avatarUrl);
      return CachedNetworkImage(
        imageUrl: url,
        imageBuilder: (_, img) =>
            CircleAvatar(radius: size / 2, backgroundImage: img),
        errorWidget:  (_, __, ___) => _initialsAvatar(name, size),
        placeholder:  (_, __)      => CircleAvatar(
            radius: size / 2,
            child: const CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return _initialsAvatar(name, size);
  }

  Widget _initialsAvatar(String name, double size) {
    const palette = [
      Color(0xFF1D4ED8),
      Color(0xFF7C3AED),
      Color(0xFF0F766E),
      Color(0xFFC2410C),
      Color(0xFF15803D),
    ];
    final idx = name.isEmpty ? 0 : name.codeUnitAt(0) % palette.length;
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: palette[idx],
      child: Text(
        name.isEmpty ? '?' : name[0].toUpperCase(),
        style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.4,
            fontWeight: FontWeight.bold),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(),
      body: Column(
        children: [
          Expanded(child: _buildMessages()),
          if (_isTyping) _buildTypingRow(),
          _buildInputBar(),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      titleSpacing: 0,
      title: Row(
        children: [
          _avatar(_otherName, _otherAvatar, size: 36),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_otherName,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                if ((_other['username'] ?? '').toString().isNotEmpty)
                  Text('@${_other['username']}',
                      style:
                          const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessages() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 40),
              const SizedBox(height: 12),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 16),
              ElevatedButton(
                  onPressed: _loadMessages, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _avatar(_otherName, _otherAvatar, size: 64),
              const SizedBox(height: 12),
              Text(_otherName,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              const Text('Start the conversation!',
                  style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      );
    }
    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      itemCount: _messages.length,
      itemBuilder: (_, i) => _buildBubble(_messages[i]),
    );
  }

  Widget _buildBubble(Map<String, dynamic> msg) {
    final isMe    = _isMe(msg);
    final content = (msg['content'] ?? msg['text'] ?? '').toString();
    final time    = _fmtTime(msg['ts']);
    final status  = _deliveryStatus(msg);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            _avatar(_otherName, _otherAvatar),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72,
              ),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: isMe
                    ? Theme.of(context).colorScheme.primary
                    : Colors.grey.shade800,
                borderRadius: BorderRadius.only(
                  topLeft:     const Radius.circular(16),
                  topRight:    const Radius.circular(16),
                  bottomLeft:  Radius.circular(isMe ? 16 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 16),
                ),
              ),
              child: Column(
                crossAxisAlignment: isMe
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  Text(content,
                      style: const TextStyle(
                          color: Colors.white, fontSize: 14)),
                  const SizedBox(height: 2),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(time,
                          style: const TextStyle(
                              color: Colors.white60, fontSize: 10)),
                      if (isMe) ...[
                        const SizedBox(width: 4),
                        _statusIcon(status),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (isMe) const SizedBox(width: 6),
        ],
      ),
    );
  }

  Widget _statusIcon(DeliveryStatus status) {
    switch (status) {
      case DeliveryStatus.sending:
        return const Icon(Icons.access_time, size: 10, color: Colors.white54);
      case DeliveryStatus.sent:
        return const Icon(Icons.done, size: 11, color: Colors.white60);
      case DeliveryStatus.delivered:
        return const Icon(Icons.done_all, size: 11, color: Colors.white70);
      case DeliveryStatus.read:
        return const Icon(Icons.done_all, size: 11, color: Color(0xFF60A5FA));
    }
  }

  Widget _buildTypingRow() {
    return Padding(
      padding: const EdgeInsets.only(left: 14, bottom: 4),
      child: Row(
        children: [
          _avatar('me', null, size: 24),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.8),
              borderRadius: BorderRadius.circular(16),
            ),
            child: _TypingDots(dotAnim: _dotAnim),
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 8,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 4,
              offset: const Offset(0, -2))
        ],
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.share_location, color: Color(0xFF4ADE80)),
            tooltip: 'Share Location',
            onPressed: _shareLocation,
          ),
          Expanded(
            child: TextField(
              controller: _textCtrl,
              onChanged: _onTextChanged,
              maxLines: 4,
              minLines: 1,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _sendText(),
              decoration: InputDecoration(
                hintText: 'Message $_otherName…',
                filled: true,
                fillColor: Colors.grey.shade900,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
            ),
          ),
          const SizedBox(width: 6),
          IconButton(
            icon: Icon(
              Icons.send_rounded,
              color: (_sending || _convId.isEmpty)
                  ? Colors.grey
                  : Theme.of(context).colorScheme.primary,
            ),
            onPressed: (_sending || _convId.isEmpty) ? null : _sendText,
          ),
        ],
      ),
    );
  }
}

// ── Delivery status enum ──────────────────────────────────────────────────────

enum DeliveryStatus { sending, sent, delivered, read }

// ── Typing indicator (3 bouncing dots) ────────────────────────────────────────

class _TypingDots extends StatelessWidget {
  final List<Animation<double>> dotAnim;

  const _TypingDots({required this.dotAnim});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        3,
        (i) => AnimatedBuilder(
          animation: dotAnim[i],
          builder: (_, __) => Transform.translate(
            offset: Offset(0, dotAnim[i].value),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Container(
                width: 7,
                height: 7,
                decoration: const BoxDecoration(
                  color: Colors.white70,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
