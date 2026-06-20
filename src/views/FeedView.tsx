import { useState, useEffect, FormEvent } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  addDoc, 
  deleteDoc,
  increment,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { Post, Comment, UserProfile } from '../types';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Trash2, 
  Send, 
  CheckCircle2, 
  Hash, 
  UserPlus, 
  Flame,
  MessageSquare
} from 'lucide-react';
import { DEFAULT_AVATARS } from '../constants';

interface FeedViewProps {
  currentUser: any;
  userProfile: UserProfile | null;
  onViewChange: (view: string, targetUser?: string) => void;
}

export default function FeedView({ currentUser, userProfile, onViewChange }: FeedViewProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string, count: number }[]>([]);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Active snapshot for posts
  useEffect(() => {
    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Post[];
      setPosts(postsList);
      setLoading(false);

      // Extract trending hashtags dynamically from real-time posts
      const counts: { [key: string]: number } = {};
      postsList.forEach(p => {
        if (p.hashtags && Array.isArray(p.hashtags)) {
          p.hashtags.forEach(tag => {
            const cleanTag = tag.trim().toLowerCase();
            if (cleanTag) {
              counts[cleanTag] = (counts[cleanTag] || 0) + 1;
            }
          });
        }
      });
      const sortedTags = Object.entries(counts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTrendingTags(sortedTags);
    }, (error) => {
      console.error("Posts read error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync comments for commentingPostId
  useEffect(() => {
    if (!commentingPostId) return;

    const commentsQuery = query(
      collection(db, 'posts', commentingPostId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Comment[];
      setComments(prev => ({
        ...prev,
        [commentingPostId]: commentsList
      }));
    });

    return () => unsubscribe();
  }, [commentingPostId]);

  // Read suggested users
  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const allUsers = snapshot.docs.map(d => d.data() as UserProfile)
        .filter(u => u.uid !== currentUser.uid && !u.isBanned)
        .slice(0, 5);
      setSuggestedUsers(allUsers);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Toggle Live Post Like
  const handleLikeToggle = async (post: Post) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    const isLiked = post.likes && post.likes.includes(currentUser.uid);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(currentUser.uid),
          likesCount: increment(-1)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(currentUser.uid),
          likesCount: increment(1)
        });

        // Trigger Real-Time Notification context
        if (post.userId !== currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: post.userId,
            senderId: currentUser.uid,
            senderUsername: userProfile?.username || 'user',
            senderPhotoURL: userProfile?.photoURL || DEFAULT_AVATARS[0],
            type: 'like',
            postId: post.id,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  // Submit Comments Real-Time
  const handleCommentSubmit = async (e: FormEvent, postId: string, postUserId: string) => {
    e.preventDefault();
    if (!newCommentText.trim() || !userProfile) return;

    const commentText = newCommentText.trim();
    setNewCommentText('');

    try {
      // Add comment subdocument
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        userId: currentUser.uid,
        userDisplayName: userProfile.displayName,
        userUsername: userProfile.username,
        userPhotoURL: userProfile.photoURL,
        content: commentText,
        createdAt: new Date().toISOString()
      });

      // Atomically increment counter
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1)
      });

      // Dispatch real alert notification
      if (postUserId !== currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: postUserId,
          senderId: currentUser.uid,
          senderUsername: userProfile.username,
          senderPhotoURL: userProfile.photoURL,
          type: 'comment',
          postId: postId,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Error posting comment:", err);
    }
  };

  // Delete Post
  const handlePostDelete = async (postId: string) => {
    if (!window.confirm("Deseja realmente excluir este post? Essa ação não pode ser desfeita.")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  // Handle click to copy simulated link shares
  const handleShareClick = (postId: string) => {
    const simulatedLink = `${window.location.origin}/#post-${postId}`;
    navigator.clipboard.writeText(simulatedLink);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2500);
  };

  // Start direct message flow with suggested users
  const handleStartChat = async (targetUser: UserProfile) => {
    onViewChange('messages', targetUser.uid);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto py-4 px-2" id="feed-container">
      {/* Scrollable Main Stream Feed */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        {/* Stories Horizontal Strip */}
        <div className="bg-zinc-900 border border-zinc-800/60 rounded-3xl p-5 flex items-center gap-4 overflow-x-auto scrollbar-hide">
          {/* Active User Story Bubble */}
          <div className="flex flex-col items-center shrink-0 cursor-pointer group">
            <div className="relative">
              <img 
                src={userProfile?.photoURL || DEFAULT_AVATARS[0]} 
                className="w-16 h-16 rounded-full object-cover p-1 ring-2 ring-zinc-700 group-hover:scale-105 transition"
                alt="Meu status"
              />
              <span className="absolute bottom-0 right-0 bg-cyan-500 text-white rounded-full p-0.5 text-xs font-bold">+</span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1.5 max-w-[70px] truncate text-center">Seu Story</span>
          </div>

          {/* Random Simulated Stories of suggested profiles */}
          {suggestedUsers.map((user, idx) => (
            <div 
              key={idx} 
              onClick={() => onViewChange('profile', user.username)}
              className="flex flex-col items-center shrink-0 cursor-pointer group"
            >
              <img 
                src={user.photoURL} 
                className="w-16 h-16 rounded-full object-cover p-1 ring-2 ring-gradient ring-cyan-400 group-hover:scale-105 transition"
                alt={user.displayName}
              />
              <span className="text-[10px] text-zinc-300 mt-1.5 max-w-[70px] truncate text-center font-medium">
                {user.username}
              </span>
            </div>
          ))}
        </div>

        {/* Load Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            <span className="text-xs font-medium">Sincronizando feed global em tempo real...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-12 text-center flex flex-col items-center gap-4">
            <Flame className="w-12 h-12 text-zinc-600 animate-pulse" />
            <h3 className="text-lg font-bold text-zinc-200">O feed global está vazio</h3>
            <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
              Seja a primeira pessoa a agitar a plataforma! Escreva, anexe fotos ou crie um TikTok-style Reel hoje mesmo.
            </p>
            <button 
              onClick={() => onViewChange('upload')}
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition"
            >
              Publicar Agora
            </button>
          </div>
        ) : (
          /* Posts Stack Feed */
          <div className="flex flex-col gap-6">
            {posts.map((post) => {
              const isLiked = post.likes && post.likes.includes(currentUser.uid);
              const isOwner = post.userId === currentUser.uid;
              const hasAdminPower = userProfile?.isAdmin === true;
              const isUserVerified = post.userId === userProfile?.uid ? userProfile?.isVerified : true; // Fallback helper

              return (
                <article 
                  key={post.id} 
                  id={`post-card-${post.id}`}
                  className="bg-zinc-900 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-xl"
                >
                  {/* Card Header Profile Block */}
                  <div className="p-4 flex items-center justify-between border-b border-zinc-800/40">
                    <div className="flex items-center gap-3">
                      <img 
                        src={post.userPhotoURL || DEFAULT_AVATARS[0]} 
                        alt="Criador" 
                        className="w-10 h-10 rounded-full object-cover cursor-pointer ring-1 ring-zinc-800"
                        onClick={() => onViewChange('profile', post.userUsername)}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span 
                            onClick={() => onViewChange('profile', post.userUsername)}
                            className="text-xs font-bold text-zinc-200 hover:underline cursor-pointer"
                          >
                            {post.userDisplayName}
                          </span>
                          {/* Real-time verification badge */}
                          {post.userUsername === 'jpvano' || post.userId === 'jpvanoredesocial@gmail.com' || post.userId === 'jpcodogn411@gmail.com' || (post.likesCount > 4) ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
                          ) : null}
                        </div>
                        <span className="text-[10px] text-zinc-500">@{post.userUsername}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                      {post.isReel && (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Reel
                        </span>
                      )}

                      {/* Delete Trigger for Post Owner OR Admin Role */}
                      {(isOwner || hasAdminPower) && (
                        <button 
                          onClick={() => handlePostDelete(post.id)}
                          className="p-2 hover:bg-red-950/20 hover:text-red-400 rounded-lg text-zinc-500 transition ml-2"
                          title="Excluir publicação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Caption Texts */}
                  <div className="px-5 py-3">
                    <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed select-text">
                      {post.content}
                    </p>
                  </div>

                  {/* Integrated Media Block */}
                  {post.mediaUrl && post.mediaType !== 'none' && (
                    <div className="bg-zinc-950 border-y border-zinc-800/40 relative max-h-[460px] overflow-hidden flex items-center justify-center">
                      {post.mediaType === 'video' ? (
                        <video 
                          src={post.mediaUrl}
                          controls
                          className="w-full object-contain max-h-[460px]"
                          playsInline
                        />
                      ) : (
                        <img 
                          src={post.mediaUrl} 
                          alt="Post Media" 
                          className="w-full object-cover max-h-[460px]"
                        />
                      )}
                    </div>
                  )}

                  {/* Actions Bar Footer */}
                  <div className="p-4 flex items-center justify-between border-t border-zinc-900 bg-zinc-950/20">
                    <div className="flex items-center gap-6">
                      {/* Like Control */}
                      <button 
                        onClick={() => handleLikeToggle(post)}
                        className={`flex items-center gap-2 group cursor-pointer text-xs font-semibold select-none transition ${
                          isLiked ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-5 h-5 transition-transform group-active:scale-125 ${isLiked ? 'fill-rose-500 stroke-rose-500' : ''}`} />
                        <span>{post.likesCount || 0}</span>
                      </button>

                      {/* Comments count trigger */}
                      <button 
                        onClick={() => setCommentingPostId(commentingPostId === post.id ? null : post.id)}
                        className="flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-semibold transition"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>{post.commentsCount || 0}</span>
                      </button>

                      {/* Share control */}
                      <button 
                        onClick={() => handleShareClick(post.id)}
                        className={`flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-semibold transition ${
                          copiedPostId === post.id ? 'text-emerald-400 font-bold' : ''
                        }`}
                      >
                        <Share2 className="w-5 h-5" />
                        <span>{copiedPostId === post.id ? 'Copiado!' : 'Compartilhar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expand Comments Block */}
                  {commentingPostId === post.id && (
                    <div className="bg-zinc-950/60 border-t border-zinc-800 p-4 space-y-4">
                      <h4 className="text-xs font-bold text-zinc-400 mb-3 block border-b border-zinc-800/40 pb-2">
                        Comentários ({post.commentsCount || 0})
                      </h4>

                      {/* List comments in real-time */}
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {!comments[post.id] ? (
                          <div className="text-[10px] text-zinc-600 py-2">Carregando comentários...</div>
                        ) : comments[post.id].length === 0 ? (
                          <div className="text-[10px] text-zinc-600 py-2 italic">Nenhum comentário ainda. Comece a conversa!</div>
                        ) : (
                          comments[post.id].map((com) => (
                            <div key={com.id} className="flex gap-2.5 items-start text-xs border-b border-zinc-900 pb-2">
                              <img 
                                src={com.userPhotoURL || DEFAULT_AVATARS[0]} 
                                className="w-7 h-7 rounded-full object-cover cursor-pointer mt-0.5"
                                alt="Avatar"
                                onClick={() => onViewChange('profile', com.userUsername)}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 label text-zinc-300">
                                  <span 
                                    className="font-bold cursor-pointer hover:underline"
                                    onClick={() => onViewChange('profile', com.userUsername)}
                                  >
                                    {com.userDisplayName}
                                  </span>
                                  <span className="text-[9px] text-zinc-500">@{com.userUsername}</span>
                                </div>
                                <p className="text-zinc-200 leading-relaxed text-[11px] font-medium mt-0.5">{com.content}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Comments Input Form */}
                      <form onSubmit={(e) => handleCommentSubmit(e, post.id, post.userId)} className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Adicione um comentário..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          type="submit"
                          className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Desktop sidebar: Trends, Suggested, Admin quick tips */}
      <div className="lg:col-span-4 hidden lg:flex flex-col gap-6">
        {/* Compact User Identity Profile Card */}
        <div className="bg-zinc-900 border border-zinc-800/60 rounded-3xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={userProfile?.photoURL || DEFAULT_AVATARS[0]} 
              className="w-12 h-12 rounded-full object-cover border border-zinc-800 ring-2 ring-cyan-500/10"
              alt="Minha conta"
              onClick={() => onViewChange('profile')}
            />
            <div className="flex flex-col">
              <span onClick={() => onViewChange('profile')} className="text-xs font-bold text-white hover:underline cursor-pointer">
                {userProfile?.displayName}
              </span>
              <span className="text-[10px] text-zinc-500">@{userProfile?.username}</span>
            </div>
          </div>
          {userProfile?.isVerified && (
            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-full font-semibold">
              Verificado
            </span>
          )}
        </div>

        {/* Suggest who to follow */}
        <div className="bg-zinc-900 border border-zinc-800/60 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-300">Sugestões para Você</h4>
            <span className="text-[10px] text-cyan-400 cursor-pointer hover:underline" onClick={() => onViewChange('explore')}>Descobrir</span>
          </div>

          <div className="space-y-3">
            {suggestedUsers.length === 0 ? (
              <p className="text-[10px] text-zinc-600">Nenhum outro usuário cadastrado no momento.</p>
            ) : (
              suggestedUsers.map((user) => (
                <div key={user.uid} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <img 
                      src={user.photoURL} 
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-zinc-800 cursor-pointer shrink-0" 
                      alt="Sugerido"
                      onClick={() => onViewChange('profile', user.username)}
                    />
                    <div className="flex flex-col overflow-hidden">
                      <div className="flex items-center gap-1">
                        <span 
                          onClick={() => onViewChange('profile', user.username)}
                          className="text-[11px] font-bold text-zinc-200 hover:underline cursor-pointer truncate"
                        >
                          {user.displayName}
                        </span>
                        {user.isVerified && <CheckCircle2 className="w-3 h-3 text-cyan-400 fill-cyan-400/20" />}
                      </div>
                      <span className="text-[9px] text-zinc-500 truncate">@{user.username}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleStartChat(user)}
                      className="p-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px] transition"
                      title="Chame no chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => onViewChange('profile', user.username)}
                      className="text-[9px] bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-2 py-1.5 rounded-lg transition"
                    >
                      Seguir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Trending Hashtags aggregated live */}
        <div className="bg-zinc-900 border border-zinc-800/60 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Assuntos em Destaque</span>
          </div>

          <div className="space-y-2.5">
            {trendingTags.length === 0 ? (
              <p className="text-[10px] text-zinc-600">Nenhum assunto em alta no momento. Escreva posts com hashtags!</p>
            ) : (
              trendingTags.map((trend, index) => (
                <div 
                  key={index} 
                  onClick={() => onViewChange('explore')}
                  className="flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400 transition" />
                    <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition">
                      #{trend.tag}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 transition">
                    {trend.count} {trend.count === 1 ? 'post' : 'posts'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Network Footer */}
        <div className="px-2 text-[10px] text-zinc-600 text-center">
          <p>© 2026 JPvano Network. Sincronizado globalmente em Nuvem Firebase.</p>
        </div>
      </div>
    </div>
  );
}
