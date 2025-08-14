import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:share_jesus_today/src/models/video_model.dart';
import 'package:share_jesus_today/src/widgets/video_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // Mock data for now
  final List<Video> _videos = List.generate(10, (index) => Video(
    id: '$index',
    title: 'Video Title $index: A wonderful journey through creation',
    thumbnailUrl: 'https://picsum.photos/seed/video$index/800/450',
    videoUrl: 'https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4',
    uploaderName: 'User $index',
    uploaderAvatarUrl: 'https://i.pravatar.cc/150?u=user$index',
  ));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Share Jesus Today'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      ),
      body: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 8.0),
        itemCount: _videos.length,
        itemBuilder: (context, index) {
          final video = _videos[index];
          return VideoCard(
            video: video,
            onTap: () {
              context.go('/video/${video.id}', extra: video);
            },
          );
        },
      ),
    );
  }
}
