import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:video_trimmer/video_trimmer.dart';

class VideoTrimmerScreen extends StatefulWidget {
  final String videoPath;

  const VideoTrimmerScreen({super.key, required this.videoPath});

  @override
  State<VideoTrimmerScreen> createState() => _VideoTrimmerScreenState();
}

class _VideoTrimmerScreenState extends State<VideoTrimmerScreen> {
  final Trimmer _trimmer = Trimmer();
  double _startValue = 0.0;
  double _endValue = 0.0;
  bool _isPlaying = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadVideo();
  }

  void _loadVideo() {
    _trimmer.loadVideo(videoFile: File(widget.videoPath));
  }

  Future<void> _saveVideo() async {
    setState(() {
      _isSaving = true;
    });

    await _trimmer.saveTrimmedVideo(
      startValue: _startValue,
      endValue: _endValue,
      onSave: (String? outputPath) {
        if (mounted) {
          setState(() {
            _isSaving = false;
          });
          if (outputPath != null) {
            // TODO: Implement upload logic
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Video saved! Mock uploading...')),
            );
            // Pop back to home screen
            context.go('/');
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to save video')),
            );
          }
        }
      },
    );
  }

  @override
  void dispose() {
    _trimmer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Trim Video'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          if (_isSaving)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: CircularProgressIndicator(color: Colors.white),
            )
          else
            IconButton(
              icon: const Icon(Icons.check),
              onPressed: _saveVideo,
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: VideoViewer(trimmer: _trimmer),
            ),
          ),
          TrimViewer(
            trimmer: _trimmer,
            viewerHeight: 50.0,
            viewerWidth: MediaQuery.of(context).size.width,
            maxVideoLength: const Duration(minutes: 5), // Example max length
            onChangeStart: (value) => setState(() => _startValue = value),
            onChangeEnd: (value) => setState(() => _endValue = value),
            onChangePlaybackState: (value) => setState(() => _isPlaying = value),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextButton(
              child: _isPlaying
                  ? const Icon(Icons.pause, size: 60.0, color: Colors.white)
                  : const Icon(Icons.play_arrow, size: 60.0, color: Colors.white),
              onPressed: () async {
                bool playbackState = await _trimmer.videoPlaybackControl(
                  startValue: _startValue,
                  endValue: _endValue,
                );
                setState(() => _isPlaying = playbackState);
              },
            ),
          )
        ],
      ),
    );
  }
}
