import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Post, Chat } from '../types';
import { 
  ShieldCheck, 
  Ban, 
  UserCheck, 
  Trash2, 
  Users, 
  Tv, 
  Lock, 
  CheckCircle2, 
  Crown,
  Activity,
  MessageSquare
} from 'lucide-react';
import { DEFAULT_AVATARS } from '../constants';

interface AdminViewProps {
  currentUser: any;
  userProfile: UserProfile | null;
  onViewChange: (view: string, target?: string) => void;
}

export default function AdminView({ currentUser, userProfile, onViewChange }: AdminViewProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLog, setAuditLog] = useState<{ id: string; action: string; time: string }[]>([]);

  const isSuperAdmin = userProfile?.email === 'jpvanoredesocial@gmail.com' || userProfile?.isAdmin === true;

  // Real-time subscribers of system assets
  useEffect(() => {
    if (!isSuperAdmin) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => d.data() as UserProfile)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUsers(list);
      setLoading(false);
    });

    const unsubPosts = onSnapshot(collection(db, 'posts'), (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post));
    });

    const unsubChats = onSnapshot(collection(db, 'chats'), (snap) => {
      setChats(snap.docs.map(d => d.data() as Chat));
    });

    return () => {
      unsubUsers();
      unsubPosts();
      unsubChats();
    };
  }, [isSuperAdmin]);

  // Push actions to logs
  const addToLogs = (action: string) => {
    setAuditLog(prev => [
      { id: `${Date.now()}`, action, time: new Date().toLocaleTimeString() },
      ...prev
    ].slice(0, 5));
  };

  // Toggle user Verification Badge
  const handleToggleVerified = async (targetUser: UserProfile) => {
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        isVerified: !targetUser.isVerified
      });
      addToLogs(`Selo de verificado da conta @${targetUser.username} alterado.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle User Ban
  const handleToggleBan = async (targetUser: UserProfile) => {
    if (targetUser.email === 'jpvanoredesocial@gmail.com' || targetUser.email === 'jpcodogn411@gmail.com') {
      alert("Não é permitido banir administradores fundadores!");
      return;
    }
    if (targetUser.uid === currentUser.uid) {
      alert("Você não pode auto-aplicar banimentos!");
      return;
    }
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        isBanned: !targetUser.isBanned
      });
      addToLogs(`Status de banimento de @${targetUser.username} alternado.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Admin Promotion Role
  const handleToggleAdmin = async (targetUser: UserProfile) => {
    if (targetUser.email === 'jpvanoredesocial@gmail.com' || targetUser.email === 'jpcodogn411@gmail.com') {
      alert("Não é possível remover o cargo de administradores fundadores!");
      return;
    }
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        isAdmin: !targetUser.isAdmin
      });
      addToLogs(`Privilégios administrativos de @${targetUser.username} alterados.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Admin delete post
  const handleAdminDeletePost = async (postId: string, username: string) => {
    if (!window.confirm(`Apagar publicação da conta @${username}?`)) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      addToLogs(`Publicação id ${postId} de @${username} foi desativada pelo Admin.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Access restriction checker fallback UI
  if (!isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-4" id="admin-rejected-pane">
        <Lock className="w-14 h-14 text-rose-500 mx-auto animate-bounce" />
        <h3 className="text-lg font-bold text-white">Acesso Não Autorizado</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          O Painel de Controle Administrativo é restrito exclusivamente a administradores do sistema.
        </p>
        <button 
          onClick={() => onViewChange('feed')}
          className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer"
        >
          Voltar ao Feed Global
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-8" id="admin-panel-ui">
      
      {/* 1. Header Admin banner */}
      <div className="bg-gradient-to-r from-red-950/40 via-purple-950/20 to-zinc-900 border border-zinc-800/80 rounded-3.5xl p-6 md:p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-2xl">
            <Crown className="w-8 h-8 text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Painel de Controle JPvano Staff
            </h2>
            <p className="text-[10px] text-zinc-500">
              Conectado como @{userProfile?.username || 'Admin'} (Super Admin verificado em Nuvem)
            </p>
          </div>
        </div>

        <span className="hidden md:inline-flex text-[9px] bg-red-400/10 text-red-400 font-extrabold px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-widest animate-pulse">
          Sessão Segura
        </span>
      </div>

      {/* 2. Visual quick stats bento boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide block font-semibold">Membros</span>
            <span className="text-xl font-black text-white">{users.length}</span>
          </div>
          <Users className="w-6 h-6 text-cyan-400 opacity-80" />
        </div>

        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide block font-semibold">Posts Globais</span>
            <span className="text-xl font-black text-white">{posts.length}</span>
          </div>
          <Activity className="w-6 h-6 text-rose-400 opacity-80" />
        </div>

        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide block font-semibold">Salas Direct</span>
            <span className="text-xl font-black text-white">{chats.length}</span>
          </div>
          <MessageSquare className="w-6 h-6 text-purple-400 opacity-80" />
        </div>

        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide block font-semibold">Selo Verificado</span>
            <span className="text-xl font-black text-white">
              {users.filter(u => u.isVerified).length}
            </span>
          </div>
          <ShieldCheck className="w-6 h-6 text-green-400 opacity-80" />
        </div>
      </div>

      {/* 3. Main lists layout splits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* User Account Controls list (Col span 8) */}
        <div className="lg:col-span-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Gerenciamento de Contas ({users.length})</span>
            </h3>
          </div>

          <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-6 text-xs text-zinc-650">Carregando usuários...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-650 italic">Sem usuários na rede.</div>
            ) : (
              users.map((user) => (
                <div 
                  key={user.uid} 
                  className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    user.isBanned 
                      ? 'bg-red-950/20 border-red-900/50' 
                      : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.photoURL || DEFAULT_AVATARS[0]} 
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-zinc-800" 
                      alt="User list" 
                    />
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white hover:underline cursor-pointer" onClick={() => onViewChange('profile', user.username)}>
                          {user.displayName}
                        </span>
                        {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />}
                      </div>
                      <span className="text-[9px] text-zinc-500">@{user.username} | {user.email}</span>
                    </div>
                  </div>

                  {/* Actions pills row */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Promote Admin Toggle */}
                    <button
                      onClick={() => handleToggleAdmin(user)}
                      className={`text-[9px] font-bold px-2 py-1.5 rounded-lg border transition ${
                        user.isAdmin
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-850 hover:bg-zinc-800'
                      }`}
                      title={user.isAdmin ? 'Remover Admin' : 'Promover a Staff Admin'}
                    >
                      Admin
                    </button>

                    {/* Verify Toggle */}
                    <button
                      onClick={() => handleToggleVerified(user)}
                      className={`text-[9px] font-bold px-2 py-1.5 rounded-lg border transition ${
                        user.isVerified
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500 hover:text-white'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-850 hover:bg-zinc-800'
                      }`}
                      title="Alternar selo verificado"
                    >
                      Verificado
                    </button>

                    {/* Ban Toggle */}
                    <button
                      onClick={() => handleToggleBan(user)}
                      className={`text-[9px] font-bold px-2 py-1.5 rounded-lg border transition ${
                        user.isBanned
                          ? 'bg-red-500 text-white border-red-400'
                          : 'bg-red-950/30 text-red-400 border-red-900/40 hover:bg-red-500 hover:text-white'
                      }`}
                      title={user.isBanned ? 'Desbanir Usuário' : 'Banir Conta'}
                    >
                      {user.isBanned ? 'Banido' : 'Banir'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global posts controls & live audit logs (Col span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Global Content deletions logs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-850 pb-3">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Publicações Recentes</span>
            </h3>

            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
              {posts.length === 0 ? (
                <span className="text-[10px] text-zinc-600">Nenhum post no feed global.</span>
              ) : (
                posts.slice(0, 5).map((post) => (
                  <div key={post.id} className="flex items-center justify-between gap-2 p-2 bg-zinc-950/40 border border-zinc-900 rounded-xl text-left">
                    <div className="overflow-hidden">
                      <span className="text-[10px] font-bold text-zinc-400 block truncate">@{post.userUsername}</span>
                      <span className="text-[9px] text-zinc-500 line-clamp-1 italic">"{post.content}"</span>
                    </div>
                    <button
                      onClick={() => handleAdminDeletePost(post.id, post.userUsername)}
                      className="p-1.5 bg-red-950/20 border border-red-900/10 text-red-400 rounded-lg shrink-0 hover:bg-red-500 hover:text-white transition"
                      title="Apagar Post do Feed Global"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Audit Logs events */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 flex-1">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-850 pb-3">
              <Activity className="w-4 h-4 text-yellow-400" />
              <span>Moderação em Tempo Real</span>
            </h3>

            <div className="space-y-2">
              {auditLog.length === 0 ? (
                <div className="text-[9px] text-zinc-600 italic text-center py-4">Aguardando auditoria fiscal...</div>
              ) : (
                auditLog.map((log) => (
                  <div key={log.id} className="text-[9px] leading-relaxed p-2 bg-black/40 rounded-lg text-zinc-400 border border-zinc-900">
                    <span className="text-yellow-500/80 font-bold block mb-0.5">[{log.time}] Action:</span>
                    <span>{log.action}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
