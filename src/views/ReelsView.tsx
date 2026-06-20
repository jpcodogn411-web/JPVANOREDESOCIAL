import { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  addDoc,
  increment,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { Post, Comment, UserProfile } from '../types';
import { 
  Heart, 
  MessageCircle, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause,
  CheckCircle2, 
  Send,
  Eye
} from 'lucide-react';
import { STOCK_REELS, DEFAULT_AVATARS } from '../constants';

interface ReelsViewProps {
  currentUser: any;
  userProfile: UserProfile | null;
  onViewChange: (view: string, targetUser?: string) => void;
}

export default function ReelsView({ currentUser, userProfile, onViewChange }: ReelsViewProps) {
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState<boolean[]>([]);
  
  // Comments management
  const [openedCommentsId, setOpenedCommentsId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [newCommentText, setNewCommentText] = useState('');

  // Video element refs
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Load all reels from Firestore
  useEffect(() => {
    const reelsQuery = query(
      collection(db, 'posts'), 
      where('isReel', '==', true)
    );

    const unsubscribe = onSnapshot(reelsQuery, async (snapshot) => {
      let list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Post[];

      // If database has no reels, seed it or merge in default STOCK_REELS options as fallback
      if (list.length === 0) {
        // Construct simulated posts from STOCK_REELS for ultimate fallback experience
        const simulatedReels: Post[] = STOCK_REELS.map((sr, idx) => ({
          id: `stock-reel-${idx}`,
          userId: 'jpvanoredesocial@gmail.com',
          userDisplayName: 'JPvano Staff',
          userUsername: 'jpvano',
          userPhotoURL: DEFAULT_AVATARS[0],
          content: `${sr.title} ${sr.hashtags.join(' ')}`,
          mediaUrl: sr.url,
          mediaType: 'video',
          likes: [],
          likesCount: 12 + idx * 15,
          commentsCount: 2 + idx * 3,
          hashtags: sr.hashtags,
          isReel: true,
          viewsCount: 420 + idx * 221,
          createdAt: new Date().toISOString()
        }));
        setReels(simulatedReels);
        setPlaying(new Array(simulatedReels.length).fill(true));
      } else {
        // Sort by dates
        list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReels(list);
        setPlaying(new Array(list.length).fill(true));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Set up intersection observer for autoplay when scrolling
  useEffect(() => {
    if (reels.length === 0) return;

    const options = {
      root: null, // viewport
      rootMargin: '0px',
      threshold: 0.6 // Trig when 60% of element is visible
    };

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        const index = Number(entry.target.getAttribute('data-index'));
        if (entry.isIntersecting) {
          setActiveIndex(index);
          
          // Play current video
          const video = videoRefs.current[index];
          if (video) {
            video.currentTime = 0;
            video.play().catch(e => console.log("Autocomplete video play delay:", e));
            
            // Increment view counter atomically in Firestore if real post
            const reel = reels[index];
            if (reel && !reel.id.startsWith('stock-')) {
              updateDoc(doc(db, 'posts', reel.id), {
                viewsCount: increment(1)
              }).catch(() => {});
            }
          }
        } else {
          // Pause scrolled-out video
          const video = videoRefs.current[index];
          if (video) {
            video.pause();
          }
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);

    // Target elements
    const elements = document.querySelectorAll('.reel-scroller-item');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
      observer.disconnect();
    };
  }, [reels]);

  // Handle Play/Pause explicit click
  const togglePlayPause = (idx: number) => {
    const video = videoRefs.current[idx];
    if (!video) return;

    const nextPlaying = [...playing];
    if (video.paused) {
      video.play().catch(() => {});
      nextPlaying[idx] = true;
    } else {
      video.pause();
      nextPlaying[idx] = false;
    }
    setPlaying(nextPlaying);
  };

  // Sync comment details
  useEffect(() => {
    if (!openedCommentsId) return;

    // Handle comments stream for the active reel
    const unsub = onSnapshot(
      query(collection(db, 'posts', openedCommentsId, 'comments'), orderBy('createdAt', 'asc')),
      (snap) => {
        setComments(prev => ({
          ...prev,
          [openedCommentsId]: snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment))
        }));
      }
    );

    return () => unsub();
  }, [openedCommentsId]);

  // Handle like toggle
  const handleLikeToggle = async (reel: Post) => {
    if (reel.id.startsWith('stock-')) {
      // Offline mock toggle for stock fallback
      const likesList = reel.likes || [];
      const index = likesList.indexOf(currentUser.uid);
      if (index > -1) {
        likesList.splice(index, 1);
        reel.likesCount -= 1;
      } else {
        likesList.push(currentUser.uid);
        reel.likesCount += 1;
      }
      setReels([...reels]);
      return;
    }

    const reelRef = doc(db, 'posts', reel.id);
    const hasLiked = reel.likes && reel.likes.includes(currentUser.uid);

    try {
      if (hasLiked) {
        await updateDoc(reelRef, {
          likes: arrayRemove(currentUser.uid),
          likesCount: increment(-1)
        });
      } else {
        await updateDoc(reelRef, {
          likes: arrayUnion(currentUser.uid),
          likesCount: increment(1)
        });

        // Trigger dynamic social alert
        if (reel.userId !== currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: reel.userId,
            senderId: currentUser.uid,
            senderUsername: userProfile?.username || 'user',
            senderPhotoURL: userProfile?.photoURL || DEFAULT_AVATARS[0],
            type: 'like',
            postId: reel.id,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit dynamic comment
  const handleCommentSubmit = async (e: FormEvent, reel: Post) => {
    e.preventDefault();
    if (!newCommentText.trim() || !userProfile) return;

    const text = newCommentText.trim();
    setNewCommentText('');

    if (reel.id.startsWith('stock-')) {
      // Offline stock comment simulation
      const postComments = comments[reel.id] || [];
      postComments.push({
        id: `mock-com-${Math.random()}`,
        userId: currentUser.uid,
        userDisplayName: userProfile.displayName,
        userUsername: userProfile.username,
        userPhotoURL: userProfile.photoURL,
        content: text,
        createdAt: new Date().toISOString()
      });
      setComments(prev => ({ ...prev, [reel.id]: postComments }));
      reel.commentsCount += 1;
      setReels([...reels]);
      return;
    }

    try {
      await addDoc(collection(db, 'posts', reel.id, 'comments'), {
        userId: currentUser.uid,
        userDisplayName: userProfile.displayName,
        userUsername: userProfile.username,
        userPhotoURL: userProfile.photoURL,
        content: text,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'posts', reel.id), {
        commentsCount: increment(1)
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-2 px-1 relative h-[calc(100vh-80px)] md:h-[calc(100vh-40px)] flex flex-col items-center justify-center overflow-hidden" id="reels-main-view">
      
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-zinc-500">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <span className="text-xs">Sincronizando Reels verticais...</span>
        </div>
      ) : reels.length === 0 ? (
        <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
          <p className="text-xs text-zinc-400">Nenhum Reel vertical encontrado.</p>
        </div>
      ) : (
        /* Vertical Scroll snapping stream wrapper */
        <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar relative rounded-3xl border border-zinc-850 bg-black">
          {reels.map((reel, index) => {
            const hasLiked = reel.likes && reel.likes.includes(currentUser.uid);
            
            return (
              <div
                key={reel.id}
                data-index={index}
                className="reel-scroller-item w-full h-full shrink-0 snap-start snap-always relative flex items-center justify-center"
              >
                {/* Full portrait background cover */}
                <video
                  ref={el => { videoRefs.current[index] = el; }}
                  src={reel.mediaUrl}
                  className="w-full h-full object-cover rounded-2xl cursor-pointer"
                  loop
                  muted={muted}
                  playsInline
                  onClick={() => togglePlayPause(index)}
                />

                {/* Video Play HUD Feedback overlay */}
                {!playing[index] && (
                  <div 
                    onClick={() => togglePlayPause(index)}
                    className="absolute inset-0 flex items-center justify-center bg-black/35 cursor-pointer z-10"
                  >
                    <Play className="w-16 h-16 text-white stroke-[1.5] opacity-80 scale-105 transition-transform" />
                  </div>
                )}

                {/* Double click floating Heart effect wrapper: double tapping likes video */}
                <div 
                  className="absolute inset-0 z-0 cursor-pointer"
                  onDoubleClick={() => handleLikeToggle(reel)}
                />

                {/* Side Right Controls Pillar */}
                <div className="absolute right-3.5 bottom-24 flex flex-col items-center gap-5 z-20">
                  {/* Account profile shortcut */}
                  <div 
                    onClick={() => onViewChange('profile', reel.userUsername)}
                    className="cursor-pointer flex flex-col items-center group relative mb-2"
                  >
                    <img 
                      src={reel.userPhotoURL || DEFAULT_AVATARS[0]} 
                      className="w-10 h-10 rounded-full object-cover border border-white/60 shadow-xl"
                      alt="Creator"
                    />
                    <span className="absolute -bottom-1 bg-cyan-400 text-black text-[9px] font-black leading-none rounded-full px-1 py-0.5">
                      +
                    </span>
                  </div>

                  {/* Likes button */}
                  <button 
                    onClick={() => handleLikeToggle(reel)} 
                    className="flex flex-col items-center gap-1 cursor-pointer transition select-none group"
                  >
                    <div className="bg-zinc-900/60 p-3 rounded-full backdrop-blur-md hover:bg-zinc-800 transition">
                      <Heart className={`w-5.5 h-5.5 transition-transform group-active:scale-130 ${
                        hasLiked ? 'text-rose-500 fill-rose-500 stroke-rose-500' : 'text-white'
                      }`} />
                    </div>
                    <span className="text-[10px] text-zinc-200 font-bold drop-shadow-xl">{reel.likesCount || 0}</span>
                  </button>

                  {/* Comments count drawer trigger */}
                  <button 
                    onClick={() => setOpenedCommentsId(openedCommentsId === reel.id ? null : reel.id)} 
                    className="flex flex-col items-center gap-1 cursor-pointer group"
                  >
                    <div className="bg-zinc-900/60 p-3 rounded-full backdrop-blur-md hover:bg-zinc-800 transition">
                      <MessageCircle className="w-5.5 h-5.5 text-white" />
                    </div>
                    <span className="text-[10px] text-zinc-200 font-bold drop-shadow-xl">{reel.commentsCount || 0}</span>
                  </button>

                  {/* sound volume toggler */}
                  <button 
                    onClick={() => setMuted(!muted)} 
                    className="flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <div className="bg-zinc-900/60 p-3 rounded-full backdrop-blur-md text-white hover:bg-zinc-800 transition">
                      {muted ? <VolumeX className="w-5.5 h-5.5" /> : <Volume2 className="w-5.5 h-5.5" />}
                    </div>
                    <span className="text-[9px] text-zinc-300 drop-shadow-xl">{muted ? 'Mudo' : 'Som'}</span>
                  </button>

                  {/* Real-time views count indicator */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="bg-zinc-900/30 p-2 text-zinc-300 rounded-full">
                      <Eye className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-[9px] text-zinc-300 font-bold drop-shadow-lg">{reel.viewsCount || 0}</span>
                  </div>
                </div>

                {/* Bottom Descriptions Overlay card */}
                <div className="absolute left-4 bottom-5 right-16 flex flex-col gap-2 z-20 pointer-events-none text-left drop-shadow-2xl">
                  {/* Account identifiers */}
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <span 
                      onClick={() => onViewChange('profile', reel.userUsername)}
                      className="text-white text-xs font-black hover:underline cursor-pointer flex items-center gap-1 font-mono"
                    >
                      @{reel.userUsername}
                    </span>
                    {/* Admin Verification Badge */}
                    {(reel.userUsername === 'jpvano' || reel.userId === 'jpvanoredesocial@gmail.com' || reel.userId === 'jpcodogn411@gmail.com') && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />}
                  </div>

                  {/* Caption & parsed tags */}
                  <p className="text-zinc-100 text-xs font-medium leading-relaxed leading-snug line-clamp-2 select-text pointer-events-auto">
                    {reel.content}
                  </p>

                  <div className="flex items-center gap-1 text-[9px] text-cyan-400 font-bold">
                    <span>⚡ JPvano Beats Sincronizado</span>
                  </div>
                </div>

                {/* Collapse Comments sliding bottom-drawer container */}
                {openedCommentsId === reel.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[65%] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 z-30 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-zinc-905 pb-3">
                      <h3 className="text-xs font-bold text-zinc-300">Respostas do Reel ({reel.commentsCount})</h3>
                      <button 
                        onClick={() => setOpenedCommentsId(null)}
                        className="text-zinc-500 hover:text-white font-mono font-bold text-xs"
                      >
                        ✕ Fechar
                      </button>
                    </div>

                    {/* Messages comments pane */}
                    <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
                      {!comments[reel.id] ? (
                        <div className="text-[10px] text-zinc-600 text-center py-4">Carregando comentários...</div>
                      ) : comments[reel.id].length === 0 ? (
                        <div className="text-[10px] text-zinc-600 text-center py-4 italic">Nenhum comentário. Mande a primeira reação!</div>
                      ) : (
                        comments[reel.id].map((com) => (
                          <div key={com.id} className="flex gap-2.5 items-start text-xs text-left">
                            <img src={com.userPhotoURL} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" alt="Sender avatar" />
                            <div>
                              <div className="flex items-center gap-1 text-zinc-400">
                                <span className="font-bold text-zinc-200">{com.userDisplayName}</span>
                                <span className="text-[9px]">@{com.userUsername}</span>
                              </div>
                              <p className="text-zinc-200 text-[11px] leading-relaxed mt-0.5">{com.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment upload field */}
                    <form onSubmit={(e) => handleCommentSubmit(e, reel)} className="flex items-center gap-2 border-t border-zinc-900 pt-3">
                      <input
                        type="text"
                        placeholder="Deixe sua reação..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-cyan-500 text-white p-2.5 rounded-xl hover:opacity-90 transition cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
