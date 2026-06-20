import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Post, UserProfile } from '../types';
import { 
  Search, 
  Hash, 
  TrendingUp, 
  Sparkles, 
  Compass, 
  Grid,
  CheckCircle2,
  Tv
} from 'lucide-react';
import { DEFAULT_AVATARS } from '../constants';

interface ExploreViewProps {
  onViewChange: (view: string, targetUser?: string) => void;
}

export default function ExploreView({ onViewChange }: ExploreViewProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load posts & users
  useEffect(() => {
    const unsubPosts = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')), (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post));
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile).filter(u => !u.isBanned));
    });

    return () => {
      unsubPosts();
      unsubUsers();
    };
  }, []);

  // Compute trending tags dynamically
  const trendingTags: { tag: string; count: number }[] = [];
  const tagCounts: { [key: string]: number } = {};
  posts.forEach(p => {
    if (p.hashtags && Array.isArray(p.hashtags)) {
      p.hashtags.forEach(h => {
        const tag = h.trim().toLowerCase().replace('#', '');
        if (tag) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      });
    }
  });
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .forEach(([tag, count]) => {
      trendingTags.push({ tag, count });
    });

  // Filter posts & users dynamically
  const queryClean = searchQuery.trim().toLowerCase();
  
  const filteredPosts = posts.filter(post => {
    if (selectedTag) {
      return post.hashtags && post.hashtags.some(h => h.trim().toLowerCase().includes(selectedTag.toLowerCase()));
    }
    if (queryClean) {
      const matchText = post.content.toLowerCase().includes(queryClean);
      const matchTag = post.hashtags && post.hashtags.some(h => h.toLowerCase().includes(queryClean));
      const matchUser = post.userUsername.toLowerCase().includes(queryClean) || post.userDisplayName.toLowerCase().includes(queryClean);
      return matchText || matchTag || matchUser;
    }
    return true; // Return all posts when no filter of any kind
  });

  const filteredUsers = queryClean ? users.filter(user => {
    return user.username.toLowerCase().includes(queryClean) || user.displayName.toLowerCase().includes(queryClean);
  }) : [];

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
      setSearchQuery('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8" id="explore-pane">
      {/* 1. Interactive Search Header */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Pesquisar publicações, hashtags ou contas de usuários..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedTag(null);
          }}
          className="w-full bg-zinc-900 border border-zinc-800/80 rounded-2xl py-4 pl-12 pr-4 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
          id="explore-search-input"
        />
        {selectedTag && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-cyan-950/60 text-cyan-400 border border-cyan-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
            <span>#{selectedTag}</span>
            <button onClick={() => setSelectedTag(null)} className="hover:text-white font-extrabold font-mono text-xs">✕</button>
          </div>
        )}
      </div>

      {/* 2. Live profiles results matched dynamically */}
      {queryClean && filteredUsers.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3 shadow-xl">
          <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Usuários Encontrados</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredUsers.map((user) => (
              <div 
                key={user.uid} 
                onClick={() => onViewChange('profile', user.username)}
                className="flex items-center gap-3 p-2 bg-zinc-950/40 hover:bg-zinc-800 rounded-2xl cursor-pointer transition border border-zinc-850"
              >
                <img src={user.photoURL || DEFAULT_AVATARS[0]} className="w-10 h-10 rounded-full object-cover shrink-0" alt="Result User" />
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white truncate">{user.displayName}</span>
                    {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />}
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate">@{user.username}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Trend Board Hashtags Quick selections */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span>Tendências de Assunto</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {trendingTags.length === 0 ? (
            <span className="text-[10px] text-zinc-600">Nenhum assunto indexado no momento. Use hashtags nos seus posts!</span>
          ) : (
            trendingTags.map((trend, idx) => {
              const active = selectedTag === trend.tag;
              return (
                <button
                  key={idx}
                  onClick={() => handleTagClick(trend.tag)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full border text-xs font-semibold cursor-pointer transition ${
                    active 
                      ? 'bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105' 
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-950'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>#{trend.tag}</span>
                  <span className={`text-[10px] rounded px-1 ${active ? 'bg-cyan-600.text-white' : 'bg-zinc-950 text-zinc-500'}`}>
                    {trend.count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Bento Discover Grid Media Layout */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Explorar Galeria Global</span>
          </div>
          <span className="text-[10px] text-zinc-500">Filtrando {filteredPosts.length} itens</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-3xl">
            <p className="text-xs text-zinc-500">Nenhuma publicação encontrada para o critério selecionado.</p>
          </div>
        ) : (
          /* Bento grid format */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" id="explore-bento-grid">
            {filteredPosts.map((post, idx) => {
              // Create modular layout size styles for bento grid rhythm
              const isLarge = idx % 5 === 0;

              return (
                <div
                  key={post.id}
                  onClick={() => onViewChange('feed')}
                  className={`group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer transition hover:shadow-2xl hover:-translate-y-1 ${
                    isLarge ? 'col-span-2 row-span-2 aspect-[4/3] md:aspect-video' : 'aspect-square'
                  }`}
                >
                  {post.mediaUrl ? (
                    post.mediaType === 'video' ? (
                      <div className="w-full h-full relative">
                        <video 
                          src={post.mediaUrl} 
                          className="w-full h-full object-cover" 
                          preload="metadata"
                          muted 
                          playsInline
                        />
                        <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur px-2 py-0.5 rounded-lg text-[9px] font-bold text-white flex items-center gap-1 uppercase">
                          <Tv className="w-3 h-3 text-cyan-400" />
                          <span>Video</span>
                        </div>
                      </div>
                    ) : (
                      <img src={post.mediaUrl} className="w-full h-full object-cover" alt="Explore asset" />
                    )
                  ) : (
                    <div className="p-5 h-full flex flex-col justify-between shrink-0 bg-gradient-to-br from-zinc-900 to-zinc-950">
                      <p className="text-xs text-zinc-300 font-mono leading-relaxed line-clamp-4 italic">
                        "{post.content}"
                      </p>
                      <span className="text-[10px] text-zinc-600 block">Texto</span>
                    </div>
                  )}

                  {/* Hover stats detail drawer */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 text-white transition-all duration-200">
                    <span className="text-xs font-bold text-cyan-400 truncate max-w-[80%]">@{post.userUsername}</span>
                    <p className="text-[10px] text-zinc-400 text-center max-w-[80%] line-clamp-2 px-1 mb-2 font-medium">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 font-bold text-xs text-zinc-200">
                        <Sparkles className="w-4.5 h-4.5 text-cyan-400" />
                        {post.likesCount || 0}
                      </span>
                      <span className="text-xs text-zinc-500">|</span>
                      <span className="text-xs font-bold text-zinc-200">
                        {post.commentsCount || 0} comentarios
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
