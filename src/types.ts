export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  photoURL: string;
  bio: string;
  isVerified: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  followersCount: number;
  followingCount: number;
  createdAt: string;
  isOnline?: boolean;
  lastActive?: string;
}

export interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userPhotoURL: string;
  content: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'none';
  likes: string[]; // List of user IDs who liked the post
  likesCount: number;
  commentsCount: number;
  hashtags: string[];
  isReel: boolean;
  viewsCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userPhotoURL: string;
  content: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageSenderId?: string;
  lastMessageTime?: string;
  unreadCount?: { [userId: string]: number };
}

export interface Message {
  id: string;
  senderId: string;
  senderUsername: string;
  content: string;
  mediaUrl?: string;
  createdAt: string;
}

export interface Follow {
  id: string; // followerId_followingId
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string; // recipient
  senderId: string;
  senderUsername: string;
  senderPhotoURL: string;
  type: 'like' | 'comment' | 'follow' | 'message';
  postId?: string;
  read: boolean;
  createdAt: string;
}
