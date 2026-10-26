import 'package:flutter/material.dart';

import '../../core/platform/mobile_actions.dart';
import 'work_timestamp_format.dart';

class PinLocationText extends StatelessWidget {
  const PinLocationText(this.value, {super.key});
  final String value;

  @override
  Widget build(BuildContext context) {
    final text = formatWorkTimestamps(value);
    final match = RegExp(
      r'^(Pin Location : )?\[(-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\]\(https://www\.google\.com/maps\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)( · Accuracy: [^\n]+ · Captured: [^\n]+)$',
    ).firstMatch(text);
    if (match == null || match[2] != match[4] || match[3] != match[5])
      return Text(text);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: match[1] ?? ''),
          WidgetSpan(
            alignment: PlaceholderAlignment.baseline,
            baseline: TextBaseline.alphabetic,
            child: InkWell(
              onTap: () => MobileActions.location('${match[2]},${match[3]}'),
              child: Text(
                '${match[2]}, ${match[3]}',
                style: const TextStyle(
                  color: Color(0xFF2563EB),
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
          TextSpan(text: match[6]),
        ],
      ),
    );
  }
}
