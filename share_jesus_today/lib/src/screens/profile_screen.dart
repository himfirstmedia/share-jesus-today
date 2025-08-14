import 'package:flutter/material.dart';
import 'package:share_jesus_today/src/models/user_model.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Mock user data for now
    final user = User(
      id: '1',
      username: 'johndoe',
      email: 'john.doe@example.com',
      profilePictureUrl: 'https://i.pravatar.cc/150?u=johndoe',
      coverPhotoUrl: 'https://picsum.photos/seed/cover/1200/400',
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Image.network(
                  user.coverPhotoUrl,
                  height: 200,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
                Positioned(
                  bottom: -50,
                  child: CircleAvatar(
                    radius: 50,
                    backgroundColor: Colors.white,
                    child: CircleAvatar(
                      radius: 48,
                      backgroundImage: NetworkImage(user.profilePictureUrl),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 60), // Space for the positioned avatar
            Text(
              user.username,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              user.email,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            // Add more profile details or user's posts here
          ],
        ),
      ),
    );
  }
}
