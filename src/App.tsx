import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Notification } from './types';
import Sidebar from './components/Sidebar';
import AuthView from './views/AuthView';
import FeedView from './views/FeedView';
import ProfileView from './views/ProfileView';
import ExploreView from './views/ExploreView';
import ReelsView from './views/ReelsView';
import UploadView from './views/UploadView';
import MessagesView from './views/MessagesView';
import AdminView from './views/AdminView';
import { 
  Bell, 
  Ban, 
  LogOut, 
  CheckCircle2, 
  X,
  Radio,
  Flame
} from 'lucide-react';
import { DEFAULT_AVATARS } from './constants';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState('feed');
  const [targetProfileUsername, setTargetProfileUsername] = useState<string | undefined>(undefined);
  const [targetChatUserId, setTargetChatUserId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Notifications and messages queues
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // 1. Subscribe to Firebase Auth and fetch User Profile Document
  useEffect(() => {
    let unsubscribeProfile: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Listen to User Profile Document in real-time
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(userRef, (profileDoc) => {
          if (profileDoc.exists()) {
            const profileData = profileDoc.data() as UserProfile;
            setUserProfile(profileData);
            
            // Auto update online status upon session discovery
            if (!profileData.isOnline) {
              updateDoc(userRef, {
                isOnline: true,
                lastActive: new Date().toISOString()
              }).catch(() => {});
            }
          }
        });
      } else {
        setUser(null);
        setUserProfile(null);
        unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  // 2. Real-time active notification listener
  useEffect(() => {
    if (!user) return;

    const notifsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(notifsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      // Sort recent notifications desc
      const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(sorted);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Keep track of dynamic unread messaging signals in chats references
  useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const chatData = doc.data();
        if (chatData.lastMessageSenderId && chatData.lastMessageSenderId !== user.uid) {
          // Simplistic check: if last message sender is not current user and view is not active chat, add 1 unread
          count += 1;
        }
      });
      setUnreadMessagesCount(count);
    });

    return () => unsubscribe();
  }, [user]);

  // 4. Update online session indicators upon closing browser tab on-unload
  useEffect(() => {
    if (!user) return;

    const handleTabClosure = () => {
      updateDoc(doc(db, 'users', user.uid), {
        isOnline: false,
        lastActive: new Date().toISOString()
      });
    };

    window.addEventListener('beforeunload', handleTabClosure);
    return () => window.removeEventListener('beforeunload', handleTabClosure);
  }, [user]);

  // 5. Dual-synchronized state-hash URL routing synchronizer
  useEffect(() => {
    const handleLocationHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (!hash) {
        // default view
        setCurrentView('feed');
        return;
      }

      if (hash.startsWith('profile/')) {
        const username = hash.split('profile/')[1];
        setTargetProfileUsername(username);
        setCurrentView('profile');
      } else if (hash.startsWith('chat/')) {
        const uid = hash.split('chat/')[1];
        setTargetChatUserId(uid);
        setCurrentView('messages');
      } else {
        setCurrentView(hash);
        setTargetProfileUsername(undefined);
        setTargetChatUserId(undefined);
      }
    };

    window.addEventListener('hashchange', handleLocationHashChange);
    handleLocationHashChange(); // trigger audit check immediately on startup
    return () => window.removeEventListener('hashchange', handleLocationHashChange);
  }, []);

  // Update routing view and hash concurrently
  const triggerViewTransition = (newView: string, parameterSlug?: string) => {
    if (newView === 'profile') {
      if (parameterSlug) {
        window.location.hash = `#profile/${parameterSlug}`;
        setTargetProfileUsername(parameterSlug);
      } else {
        window.location.hash = '#profile';
        setTargetProfileUsername(undefined);
      }
    } else if (newView === 'messages' && parameterSlug) {
      window.location.hash = `#chat/${parameterSlug}`;
      setTargetChatUserId(parameterSlug);
    } else {
      window.location.hash = `#${newView}`;
      setTargetProfileUsername(undefined);
      setTargetChatUserId(undefined);
    }
    setCurrentView(newView);
    setShowNotifications(false);
  };

  const clearNotificationsQueue = async () => {
    // mark notifications as read conceptually in state, or delete them to trim DB logs
    setShowNotifications(false);
  };

  // Sign out
  const handleLogout = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: false,
          lastActive: new Date().toISOString()
        });
      } catch (err) {
        console.error("Online status clear error:", err);
      }
    }
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-zinc-500">
        <div className="text-3xl font-extrabold tracking-widest bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
          JPvano
        </div>
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-xs font-mono">Sincronizando Central Social...</span>
      </div>
    );
  }

  // Not logged in -> AuthView login screen
  if (!user) {
    return <AuthView onSuccess={() => triggerViewTransition('feed')} />;
  }

  // Banned User view block protection
  if (userProfile?.isBanned) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
          <Ban className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Sua Conta Foi Banida</h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Modificações administrativas foram aplicadas ao seu perfil por conduta inadequada em nossa plataforma global.
            </p>
          </div>
          <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 text-[11px]">
            Se você considera isso um engano, entre em contato com o suporte JPvano.
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Desconectar Sessão</span>
          </button>
        </div>
      </div>
    );
  }

  const unseenNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row pb-16 md:pb-0 font-sans antialiased">
      
      {/* 1. Left Desktop Sidebar & Mobile Bottom Navigation bar */}
      <Sidebar 
        currentView={currentView}
        onViewChange={triggerViewTransition}
        isAdmin={userProfile?.isAdmin === true}
        onLogout={handleLogout}
        unreadCount={unreadMessagesCount}
        unseenNotificationsCount={unseenNotificationsCount}
        userPhoto={userProfile?.photoURL || DEFAULT_AVATARS[0]}
      />

      {/* 2. Main Content viewport wraps */}
      <main className="flex-1 md:ml-64 p-4 md:p-6 pb-20 md:pb-6 relative min-h-screen overflow-x-hidden">
        
        {/* UPPER HEADER BAR: Logo & notification actions */}
        <header className="flex items-center justify-between pb-6 border-b border-zinc-90 w-full mb-6 max-w-6xl mx-auto">
          {/* Logo block */}
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-xl font-black tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              JPvano
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <Radio className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-zinc-400">Stream Global em Tempo Real</span>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Real-time Notifications Bell toggler */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-850 hover:text-cyan-400 text-zinc-400 cursor-pointer transition"
              id="header-notification-bell"
            >
              <Bell className="w-4.5 h-4.5" />
              {unseenNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[9px] rounded-full w-4.5 h-4.5 flex items-center justify-center animate-pulse">
                  {unseenNotificationsCount}
                </span>
              )}
            </button>

            {/* Notifications Popdown Drawer */}
            {showNotifications && (
              <div 
                className="absolute right-0 top-14 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl z-40 space-y-3"
                id="header-notifications-popover"
              >
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <Flame className="w-4 h-4 text-cyan-400" />
                    Alertas Sociais ({notifications.length})
                  </span>
                  <button onClick={() => setShowNotifications(false)}>
                    <X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-zinc-600 py-4 text-center italic">Nenhuma notificação recente.</p>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => triggerViewTransition('profile', n.senderUsername)}
                        className="flex items-center gap-2.5 p-2 bg-zinc-950/40 hover:bg-zinc-800 rounded-xl cursor-pointer text-[11px] transition text-left border border-zinc-905"
                      >
                        <img src={n.senderPhotoURL} className="w-7 h-7 rounded-full object-cover" alt="Sender" />
                        <div className="overflow-hidden flex-1 leading-snug">
                          <span className="font-bold text-zinc-300">@{n.senderUsername} </span>
                          <span className="text-zinc-500">
                            {n.type === 'like' && 'curtiu sua publicação.'}
                            {n.type === 'comment' && 'comentou sua publicação.'}
                            {n.type === 'follow' && 'começou a seguir você.'}
                            {n.type === 'message' && 'enviou uma mensagem privada.'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <button 
                    onClick={clearNotificationsQueue}
                    className="w-full text-center text-[10px] text-cyan-400 font-bold hover:underline"
                  >
                    Fechar Alertas
                  </button>
                )}
              </div>
            )}

            {/* Quick Profile preview avatar */}
            <div 
              onClick={() => triggerViewTransition('profile')}
              className="flex items-center gap-2 cursor-pointer bg-zinc-900 border border-zinc-800/60 p-1.5 px-3 rounded-xl hover:bg-zinc-850 transition"
              id="header-profile-quick"
            >
              <img 
                src={userProfile?.photoURL || DEFAULT_AVATARS[0]} 
                alt="Quick Profile" 
                className="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-700"
              />
              <span className="hidden sm:inline text-xs font-bold text-zinc-300">
                @{userProfile?.username || 'me'}
              </span>
            </div>
          </div>
        </header>

        {/* View Switching Router Core rendering */}
        <div className="w-full transition-opacity duration-300 animate-fade-in">
          {currentView === 'feed' && (
            <FeedView 
              currentUser={user} 
              userProfile={userProfile} 
              onViewChange={triggerViewTransition} 
            />
          )}

          {currentView === 'profile' && (
            <ProfileView 
              currentUser={user} 
              targetUsername={targetProfileUsername} 
              userProfile={userProfile} 
              onViewChange={triggerViewTransition}
              onLogout={handleLogout}
            />
          )}

          {currentView === 'explore' && (
            <ExploreView onViewChange={triggerViewTransition} />
          )}

          {currentView === 'reels' && (
            <ReelsView 
              currentUser={user} 
              userProfile={userProfile} 
              onViewChange={triggerViewTransition} 
            />
          )}

          {currentView === 'upload' && (
            <UploadView 
              currentUser={user} 
              userProfile={userProfile} 
              onViewChange={triggerViewTransition} 
            />
          )}

          {currentView === 'messages' && (
            <MessagesView 
              currentUser={user} 
              userProfile={userProfile} 
              targetUserId={targetChatUserId} 
              onViewChange={triggerViewTransition} 
            />
          )}

          {currentView === 'admin' && (
            <AdminView 
              currentUser={user} 
              userProfile={userProfile} 
              onViewChange={triggerViewTransition} 
            />
          )}
        </div>

      </main>
    </div>
  );
}
