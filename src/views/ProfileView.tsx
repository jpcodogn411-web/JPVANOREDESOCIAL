import { useState, useEffect, FormEvent } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Post, UserProfile, Follow } from '../types';
import { 
  CheckCircle2, 
  Grid, 
  Film, 
  Edit3, 
  LogOut, 
  MessageSquare, 
  Users,
  Check,
  Save,
  Lock,
  Ban
} from 'lucide-react';
import { DEFAULT_AVATARS } from '../constants';

interface ProfileViewProps {
  currentUser: any;
  targetUsername?: string; // Optional username of profile of interest
  userProfile: UserProfile | null;
  onViewChange: (view: string, targetUser?: string) => void;
  onLogout: () => void;
}

export default function ProfileView({ 
  currentUser, 
  targetUsername, 
  userProfile, 
  onViewChange, 
  onLogout 
}: ProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [loading, setLoading] = useState(true);
  
  // Inline editing state for my own profile
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const isOwnProfile = !targetUsername || (profile && profile.uid === currentUser.uid);

  // 1. Fetch user profile dynamically
  useEffect(() => {
    let unsubscribeUser: () => void = () => {};

    const loadProfile = async () => {
      setLoading(true);
      if (!targetUsername) {
        // Viewing my own profile
        if (userProfile) {
          setProfile(userProfile);
          setEditDisplayName(userProfile.displayName);
          setEditBio(userProfile.bio);
          setEditPhoto(userProfile.photoURL);
          setLoading(false);
        }
      } else {
        // Viewing someone else's profile
        const q = query(collection(db, 'users'), where('username', '==', targetUsername.trim().toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const uDoc = snap.docs[0];
          
          // Subscribe to real-time changes of target user's profile
          unsubscribeUser = onSnapshot(doc(db, 'users', uDoc.id), (docRef) => {
            if (docRef.exists()) {
              const uData = docRef.data() as UserProfile;
              setProfile(uData);
              setEditDisplayName(uData.displayName);
              setEditBio(uData.bio);
              setEditPhoto(uData.photoURL);
            }
          });
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    };

    loadProfile();
    return () => unsubscribeUser();
  }, [targetUsername, userProfile]);

  // 2. Load associated posts & reels for this user profile in real-time
  useEffect(() => {
    if (!profile) return;

    const postsQuery = query(
      collection(db, 'posts'), 
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Post[];
      
      // Sort desc by date
      const sortedList = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPosts(sortedList);
    });

    return () => unsubscribe();
  }, [profile]);

  // 3. Load follower links in real-time
  useEffect(() => {
    if (!profile) return;

    // People who follow this user
    const followersQuery = query(collection(db, 'follows'), where('followingId', '==', profile.uid));
    const unsubscribeFollowers = onSnapshot(followersQuery, (snap) => {
      const followersList = snap.docs.map(d => d.data().followerId);
      setFollowers(followersList);
      setIsFollowing(followersList.includes(currentUser.uid));
    });

    // People this user follows
    const followingQuery = query(collection(db, 'follows'), where('followerId', '==', profile.uid));
    const unsubscribeFollowing = onSnapshot(followingQuery, (snap) => {
      const followingList = snap.docs.map(d => d.data().followingId);
      setFollowing(followingList);
    });

    return () => {
      unsubscribeFollowers();
      unsubscribeFollowing();
    };
  }, [profile, currentUser]);

  // 4. Toggle Follow/Unfollow
  const handleFollowToggle = async () => {
    if (!profile || isOwnProfile) return;
    const followId = `${currentUser.uid}_${profile.uid}`;
    const followRef = doc(db, 'follows', followId);

    try {
      if (isFollowing) {
        // Delete Follow match
        await deleteDoc(followRef);
      } else {
        // Create Follow match
        await setDoc(followRef, {
          id: followId,
          followerId: currentUser.uid,
          followingId: profile.uid,
          createdAt: new Date().toISOString()
        });

        // Trigger Alert Notification
        await setDoc(doc(collection(db, 'notifications')), {
          userId: profile.uid,
          senderId: currentUser.uid,
          senderUsername: userProfile?.username || 'user',
          senderPhotoURL: userProfile?.photoURL || DEFAULT_AVATARS[0],
          type: 'follow',
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  // 5. Update profile metadata
  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || isUpdating) return;
    setIsUpdating(true);

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
        photoURL: editPhoto.trim()
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Update profile error:", err);
    }
    setIsUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-500 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <span>Sincronizando perfil social...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-4">
        <Lock className="w-12 h-12 text-zinc-600 mx-auto animate-pulse" />
        <h3 className="text-lg font-bold text-zinc-300">Perfil Não Encontrado</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          O usuário solicitado @{targetUsername} não existe ou foi excluído da rede social JPvano.
        </p>
        <button 
          onClick={() => onViewChange('feed')}
          className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
        >
          Voltar ao Feed
        </button>
      </div>
    );
  }

  // Handle direct messaging trigger
  const handleOpenChat = () => {
    onViewChange('messages', profile.uid);
  };

  // Filter posts based on active grid tab
  const filteredPosts = posts.filter(p => activeTab === 'reels' ? p.isReel : !p.isReel);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8" id="profile-pane">
      {/* 1. Header Profile Box */}
      <div className="bg-zinc-900 border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative">
        {/* Ban sign indicator if applicable */}
        {profile.isBanned && (
          <div className="absolute top-4 right-4 bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wide">
            <Ban className="w-3.5 h-3.5" />
            <span>Banido da Rede</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar Picture */}
          <div className="relative shrink-0">
            <img 
              src={profile.photoURL || DEFAULT_AVATARS[0]} 
              alt={profile.displayName} 
              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-2 border-zinc-800 ring-4 ring-cyan-500/10"
            />
          </div>

          {/* User Bio and Stats details */}
          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
              <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-1.5">
                {profile.displayName}
                {profile.isVerified && (
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 fill-cyan-400/20" title="Verificado" />
                )}
              </h2>
              <span className="text-xs text-zinc-500">@{profile.username}</span>

              {/* Verified, Admin badges */}
              <div className="flex items-center gap-1.5 mt-1 md:mt-0">
                {profile.isAdmin && (
                  <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Staff Admin
                  </span>
                )}
              </div>
            </div>

            {/* Live Followers / Following Stats */}
            <div className="flex items-center gap-6 justify-center md:justify-start text-xs border-y border-zinc-850 py-3 md:border-0 md:py-0">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-white text-sm">{posts.length}</span>
                <span className="text-zinc-500">publicações</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-white text-sm">{followers.length}</span>
                <span className="text-zinc-500">seguidores</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-white text-sm">{following.length}</span>
                <span className="text-zinc-500">seguindo</span>
              </div>
            </div>

            {/* Profile Bio */}
            {!isEditing ? (
              <p className="text-xs text-zinc-300 leading-relaxed max-w-xl whitespace-pre-wrap">
                {profile.bio}
              </p>
            ) : (
              /* Profile edit form */
              <form onSubmit={handleProfileUpdate} className="space-y-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 block font-medium">Nome de Exibição</label>
                  <input 
                    type="text" 
                    value={editDisplayName} 
                    onChange={e => setEditDisplayName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 block font-medium">Biografia</label>
                  <textarea 
                    value={editBio} 
                    onChange={e => setEditBio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white h-16 resize-none"
                    placeholder="Conte algo legal..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 block font-medium">URL da foto do Perfil (ou escolha predefinido)</label>
                  <input 
                    type="text" 
                    value={editPhoto} 
                    onChange={e => setEditPhoto(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUpdating}
                    className="text-[10px] bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isUpdating ? 'Salvando...' : 'Salvar Alterações'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Profile CTA Controls */}
            <div className="flex items-center gap-3 justify-center md:justify-start pt-2">
              {isOwnProfile ? (
                <>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Editar Perfil</span>
                    </button>
                  )}
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1.5 bg-red-950/20 text-red-400 hover:bg-red-900 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Desconectar</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Follow / Unfollow logic trigger */}
                  <button
                    onClick={handleFollowToggle}
                    className={`flex items-center gap-1 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                      isFollowing 
                        ? 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300' 
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white shadow-lg shadow-cyan-500/10'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="w-4 h-4 text-cyan-400" />
                        <span>Seguindo</span>
                      </>
                    ) : (
                      <span>Seguir</span>
                    )}
                  </button>

                  {/* Send Direct Message */}
                  <button
                    onClick={handleOpenChat}
                    className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Mensagem</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid Tabs selections */}
      <div className="space-y-6">
        <div className="flex justify-center border-b border-zinc-850 gap-8">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 pb-4 text-xs font-bold uppercase tracking-wider relative transition ${
              activeTab === 'posts' ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Publicações</span>
            {activeTab === 'posts' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-t" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('reels')}
            className={`flex items-center gap-2 pb-4 text-xs font-bold uppercase tracking-wider relative transition ${
              activeTab === 'reels' ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Reels</span>
            {activeTab === 'reels' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-t" />
            )}
          </button>
        </div>

        {/* 3. Media Grid displays */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20 text-zinc-600 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-3xl">
            <p className="text-xs font-medium">Nenhuma publicação nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" id="profile-media-grid">
            {filteredPosts.map((post) => (
              <div 
                key={post.id}
                onClick={() => onViewChange('feed')}
                className="group relative aspect-square bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden cursor-pointer hover:shadow-2xl transition-transform hover:-translate-y-1"
              >
                {/* Image or Video preview */}
                {post.mediaUrl ? (
                  post.mediaType === 'video' ? (
                    <video 
                      src={post.mediaUrl} 
                      className="w-full h-full object-cover" 
                      preload="metadata" 
                      muted
                      playsInline
                    />
                  ) : (
                    <img src={post.mediaUrl} className="w-full h-full object-cover" alt="Grid clip" />
                  )
                ) : (
                  <div className="p-4 h-full flex items-center justify-center text-center">
                    <p className="text-[11px] text-zinc-400 line-clamp-4 leading-relaxed font-mono">
                      "{post.content}"
                    </p>
                  </div>
                )}

                {/* Hover stats overlays */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 text-white transition-opacity duration-200">
                  <span className="flex items-center gap-1.5 font-bold text-sm">
                    <Check className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                    {post.likesCount || 0}
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-sm">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    {post.commentsCount || 0}
                  </span>
                </div>

                {/* Reels icon indicator */}
                {post.isReel && (
                  <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur p-1 rounded-lg">
                    <Film className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
