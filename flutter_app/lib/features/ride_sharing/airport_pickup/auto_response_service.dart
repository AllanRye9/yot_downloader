/// Auto-response service for airport pickup bookings.
///
/// When a client opens a booking chat, the system immediately replies with
/// a structured prompt asking for the details needed to complete the booking.
/// This mirrors the server-side auto-response behaviour in the web frontend.
class AutoResponseService {
  /// The structured prompt sent to clients when they initiate a booking.
  ///
  /// Matches the server-side message emitted by `on_ride_chat_message`
  /// when the client's message count in the room reaches 1.
  static const String _promptTemplate =
      'Please share your current location, full name, and contact number '
      'to complete your booking.';

  /// Builds the auto-response prompt for a given driver.
  ///
  /// [driverName] is displayed in the greeting so the message feels personal.
  static String bookingPrompt({required String driverName}) {
    return 'Hi, I\'m $driverName. $_promptTemplate';
  }

  /// Returns the system-side booking prompt without personalisation.
  ///
  /// Used when the driver name is not yet known (e.g. map direct booking).
  static String get systemPrompt => _promptTemplate;

  /// Builds the client-side pre-fill message shown when opening a chat.
  ///
  /// This is the message the *client* sends first, prompting the driver
  /// to accept and triggering the auto-response on the server.
  static String clientBookingMessage({
    required String driverName,
    required String origin,
    required String destination,
    String? userName,
  }) {
    return 'Hi $driverName, I need an airport pickup from $origin to '
        '$destination. Please find my details below:\n\n'
        'Name: ${userName ?? '[your name]'}\n'
        'Contact: [your phone/WhatsApp]\n'
        'Current Location: [please share your location]\n\n'
        'Are you available?';
  }
}
