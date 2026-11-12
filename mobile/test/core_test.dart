import 'package:flutter_test/flutter_test.dart';
import 'package:jamia_lms/core/deep_links.dart';
import 'package:jamia_lms/core/format.dart';
import 'package:jamia_lms/meeting/meeting_service.dart';

void main() {
  const code = 'AbCdEfGhIjKlMnOpQrStUvWx';

  group('meeting links', () {
    test('a public meeting link of the portal opens the guest join', () {
      final t = DeepLinks.parse(Uri.parse('https://lms.jamiaashrafia.asia/meet/$code'));
      expect(t, isA<PublicMeetingLink>());
      expect((t as PublicMeetingLink).code, code);
    });

    test('a class link opens the class', () {
      final t = DeepLinks.parse(Uri.parse('https://lms.jamiaashrafia.asia/live.html?session=vc_1793340417565_l1jh4'));
      expect(t, isA<ClassLink>());
      expect((t as ClassLink).sessionId, 'vc_1793340417565_l1jh4');
    });

    test('the app scheme works too', () {
      expect(DeepLinks.parse(Uri.parse('jamiaashrafia://meet/$code')), isA<PublicMeetingLink>());
      expect(DeepLinks.parse(Uri.parse('jamiaashrafia://class/vc_1')), isA<ClassLink>());
    });

    test('links to other hosts and other pages are ignored', () {
      expect(DeepLinks.parse(Uri.parse('https://evil.example/meet/$code')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://lms.jamiaashrafia.asia/index.html')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://lms.jamiaashrafia.asia/meet/short')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://lms.jamiaashrafia.asia/meet/$code/extra')), isNull);
    });

    test('a pasted link or bare code gives the code', () {
      expect(DeepLinks.codeFromText('  https://lms.jamiaashrafia.asia/meet/$code '), code);
      expect(DeepLinks.codeFromText('lms.jamiaashrafia.asia/meet/$code'), code);
      expect(DeepLinks.codeFromText(code), code);
      expect(DeepLinks.codeFromText('hello'), isNull);
    });
  });

  test('room name matches the server (meetingRoomName in server/lms-api.js)', () {
    expect(
      MeetingService.roomNameFor({'id': 'vc_1793340417565_l1jh4', 'meetingUuid': 'ASH-260-470-855'}),
      'JamiaAshrafiaASH2604708555l1jh4',
    );
    expect(MeetingService.roomNameFor({'id': 'vc_12'}), 'JamiaAshrafiavc12vc12');
  });

  test('formatting helpers', () {
    expect(prettyTime('13:30'), '1:30 PM');
    expect(prettyDate('2026-10-28'), '28 Oct 2026');
    expect(money(2500), 'Rs 2,500');
    expect(initials('Muhammad Ahmad Khan'), 'MK');
  });
}
