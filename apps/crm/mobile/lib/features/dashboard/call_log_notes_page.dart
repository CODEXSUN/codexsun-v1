import 'package:flutter/material.dart';

import '../../core/api/crm_mobile_api.dart';
import 'admin_call_log_page.dart';

class CallLogNotesPage extends StatefulWidget {
  const CallLogNotesPage({
    required this.api,
    required this.session,
    required this.entry,
    required this.callLogName,
    super.key,
  });

  final CrmMobileApi api;
  final UserSession session;
  final CallLogEntry entry;
  final String callLogName;

  @override
  State<CallLogNotesPage> createState() => _CallLogNotesPageState();
}

class _CallLogNotesPageState extends State<CallLogNotesPage> {
  final _controller = TextEditingController();
  final _composerFocus = FocusNode();
  List<CrmCallLogComment> _notes = const [];
  var _isLoading = true;
  var _isSaving = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    _composerFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    resizeToAvoidBottomInset: false,
    appBar: AppBar(title: const Text('Call notes')),
    body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                    children: [
                      _ContactSummary(entry: widget.entry),
                      const SizedBox(height: 22),
                      if (_loadError != null) ...[
                        MaterialBanner(
                          content: Text(_loadError!),
                          leading: const Icon(Icons.cloud_off_outlined),
                          actions: [
                            TextButton(
                              onPressed: _isLoading ? null : _load,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],
                      Text(
                        'Saved comments',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (_notes.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 18),
                          child: Text('No CRM comments yet.'),
                        )
                      else
                        ..._notes.map((note) => _CallNoteRow(note: note)),
                    ],
                  ),
                ),
                AnimatedPadding(
                  curve: Curves.easeOutCubic,
                  duration: const Duration(milliseconds: 180),
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.viewInsetsOf(context).bottom,
                  ),
                  child: _CommentComposer(
                    controller: _controller,
                    focusNode: _composerFocus,
                    isSaving: _isSaving,
                    onSave: _saveNote,
                  ),
                ),
              ],
            ),
          ),
  );

  Future<void> _load() async {
    if (mounted) setState(() => _isLoading = true);
    try {
      final notes = await widget.api.callLogComments(
        accessToken: widget.session.accessToken,
        callLogName: widget.callLogName,
      );
      if (mounted) {
        setState(() {
          _notes = notes;
          _loadError = null;
        });
      }
      if (mounted) _focusComposer();
    } on CrmMobileApiException catch (error) {
      if (mounted) setState(() => _loadError = error.message);
    } catch (_) {
      if (mounted)
        setState(() => _loadError = 'Could not load saved comments.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _focusComposer() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _composerFocus.requestFocus();
    });
  }

  Future<void> _saveNote() async {
    final content = _controller.text.trim();
    if (content.isEmpty) return;
    setState(() => _isSaving = true);
    try {
      await widget.api.addCallLogComment(
        accessToken: widget.session.accessToken,
        callLogName: widget.callLogName,
        body: content,
      );
      _controller.clear();
      await _load();
    } on CrmMobileApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showMessage(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
}

class _ContactSummary extends StatelessWidget {
  const _ContactSummary({required this.entry});

  final CallLogEntry entry;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(entry.contactTitle, style: Theme.of(context).textTheme.titleMedium),
      if (entry.hasSavedName) Text(entry.number),
      Text('${entry.directionLabel} · ${entry.displayTime}'),
    ],
  );
}

class _CommentComposer extends StatelessWidget {
  const _CommentComposer({
    required this.controller,
    required this.focusNode,
    required this.isSaving,
    required this.onSave,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isSaving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    focusNode: focusNode,
                    minLines: 2,
                    maxLines: 2,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: Theme.of(context).dividerColor,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: Theme.of(context).colorScheme.primary,
                          width: 1.5,
                        ),
                      ),
                      hintText: 'Write a comment only',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  key: const ValueKey('submit-call-log-comment'),
                  tooltip: 'Submit comment',
                  style: IconButton.styleFrom(
                    foregroundColor: Colors.white,
                    backgroundColor: Theme.of(context).colorScheme.primary,
                  ),
                  onPressed: isSaving ? null : onSave,
                  icon: isSaving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded, color: Colors.white),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class _CallNoteRow extends StatelessWidget {
  const _CallNoteRow({required this.note});

  final CrmCallLogComment note;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(vertical: 4),
    title: Text(note.body),
    subtitle: Text(_formatNoteTime(note.createdAt)),
  );
}

String _formatNoteTime(DateTime value) {
  final local = value.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final period = local.hour >= 12 ? 'pm' : 'am';
  return '${local.day}/${local.month}/${local.year} · $hour:${local.minute.toString().padLeft(2, '0')} $period';
}
