import { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  orderBy, 
  getDocs,
  limit,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Chat, Message, UserProfile } from '../types';
import { 
  Send, 
  Smile, 
  Circle, 
  ChevronRight, 
  MessageSquare, 
  Search,
  CheckCheck,
  CheckCircle2
} from 'lucide-react';
import { DEFAULT_AVATARS } from '../constants';

interface MessagesViewProps {
  currentUser: any;
  userProfile: UserProfile | null;
  targetUserId?: string; // Optional user loaded straight from profiles
  onViewChange: (view: string, target?: string) => void;
}

export default function MessagesView({ currentUser, userProfile, targetUserId, onViewChange }: MessagesViewProps) {
  const [chats, setChats] = useState<(Chat & { otherUser?: UserProfile })[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activePartner, setActivePartner] = useState<UserProfile | null>(null);
  
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch other system active accounts in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== currentUser.uid && !u.isBanned);
      setUsersList(allUsers);
    });
    return () => unsub();
  }, [currentUser]);

  // 2. Fetch existing chats this user is a participant of
  useEffect(() => {
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatsList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Chat[];

      // For each chat, find the corresponding other participant's profile details
      const enrichedChats = await Promise.all(chatsList.map(async (chat) => {
        const otherId = chat.participantIds.find(uid => uid !== currentUser.uid);
        if (!otherId) return chat;

        // Query user info
        const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', otherId)));
        if (!userSnap.empty) {
          const uProfile = userSnap.docs[0].data() as UserProfile;
          return {
            ...chat,
            otherUser: uProfile
          };
        }
        return chat;
      }));

      // Sort recent conversations by lastMessageTime
      const sorted = (enrichedChats as any[]).sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });

      setChats(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Initiate Chat Room if targeted straightforward from Profile triggers
  useEffect(() => {
    if (!targetUserId || loading) return;

    const startDirectChat = async () => {
      // alphabetically sort key identifiers to guarantee unicity
      const pathIds = [currentUser.uid, targetUserId].sort();
      const derivedChatId = pathIds.join('_');

      const chatRef = doc(db, 'chats', derivedChatId);
      await setDoc(chatRef, {
        id: derivedChatId,
        participantIds: pathIds,
        lastMessage: 'Iniciei uma nova mensagem!',
        lastMessageSenderId: currentUser.uid,
        lastMessageTime: new Date().toISOString()
      }, { merge: true });

      setActiveChatId(derivedChatId);
      
      // Load corresponding header details
      const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', targetUserId)));
      if (!userSnap.empty) {
        setActivePartner(userSnap.docs[0].data() as UserProfile);
      }
    };

    startDirectChat();
  }, [targetUserId, loading, currentUser]);

  // 4. Load messages of activeChatId in real-time
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      setMessages(msgList);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  // Scroll to bottom helper for fresh chats
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Select a chat room from left panel list
  const chooseChatRoom = (chat: Chat & { otherUser?: UserProfile }) => {
    setActiveChatId(chat.id);
    if (chat.otherUser) {
      setActivePartner(chat.otherUser);
    }
  };

  // Select a user straight from active users pane list
  const selectCreateChat = async (partner: UserProfile) => {
    const pathIds = [currentUser.uid, partner.uid].sort();
    const derivedId = pathIds.join('_');

    const chatRef = doc(db, 'chats', derivedId);
    await setDoc(chatRef, {
      id: derivedId,
      participantIds: pathIds,
      lastMessage: '👋 Olá! Vamos conversar?',
      lastMessageSenderId: currentUser.uid,
      lastMessageTime: new Date().toISOString()
    }, { merge: true });

    setActiveChatId(derivedId);
    setActivePartner(partner);
  };

  // Send Message
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId || !userProfile) return;

    const msgText = inputText.trim();
    setInputText('');

    try {
      // Add message subdocument
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), {
        senderId: currentUser.uid,
        senderUsername: userProfile.username,
        content: msgText,
        createdAt: new Date().toISOString()
      });

      // Update parent document metadata
      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: msgText,
        lastMessageSenderId: currentUser.uid,
        lastMessageTime: new Date().toISOString()
      });

    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Filter accounts dynamically based on search
  const cleanSearch = chatSearch.trim().toLowerCase();
  
  const displayedUserPartners = usersList.filter(user => {
    return user.displayName.toLowerCase().includes(cleanSearch) || user.username.toLowerCase().includes(cleanSearch);
  });

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] grid grid-cols-1 md:grid-cols-12 bg-zinc-900 border border-zinc-805/60 rounded-3xl overflow-hidden shadow-2xl" id="messages-panel">
      
      {/* LEFT COLUMN: Rooms & Accounts */}
      <div className="md:col-span-4 border-r border-zinc-850 flex flex-col h-full bg-zinc-950/40">
        
        {/* Widescreen Search Contacts Header */}
        <div className="p-4 border-b border-zinc-900 gap-3">
          <h2 className="text-sm font-black text-white px-1 mb-3">Linha Direta Realtime</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-650" />
            <input
              type="text"
              placeholder="Pesquisar contatos..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-2 pl-9 pr-3 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* List scrollable section */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          
          {/* Chats Recentes section */}
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider px-2.5 block mb-1">Conversas Recentes</span>
            
            {loading ? (
              <div className="text-center py-4 text-[10px] text-zinc-650">Sincronizando chats...</div>
            ) : chats.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-zinc-600 italic">Nenhum chat ativo.</div>
            ) : (
              chats.map((chat) => {
                const partner = chat.otherUser;
                const active = activeChatId === chat.id;
                if (!partner) return null;

                return (
                  <button
                    key={chat.id}
                    onClick={() => chooseChatRoom(chat)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition text-left cursor-pointer ${
                      active ? 'bg-cyan-950/30 text-white' : 'hover:bg-zinc-900/60 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="relative">
                        <img src={partner.photoURL || DEFAULT_AVATARS[0]} className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-zinc-800" alt="Partner avatar" />
                        {partner.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border border-zinc-950 rounded-full" />
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden text-xs">
                        <div className="flex items-center gap-1">
                          <span className={`${active ? 'text-cyan-400 font-bold' : 'text-zinc-200'} truncate font-semibold`}>
                            {partner.displayName}
                          </span>
                          {partner.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />}
                        </div>
                        <span className="text-[10px] text-zinc-500 truncate mt-0.5 font-medium">
                          {chat.lastMessageSenderId === currentUser.uid ? 'Você: ' : ''}{chat.lastMessage}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </button>
                );
              })
            )}
          </div>

          {/* Outras Contas Ativas list */}
          <div className="space-y-1 border-t border-zinc-900/45 pt-3">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider px-2.5 block mb-1">Membros Disponíveis</span>
            
            {displayedUserPartners.length === 0 ? (
              <div className="text-center py-3 text-[10px] text-zinc-650">Nenhum membro encontrado.</div>
            ) : (
              displayedUserPartners.map((user) => (
                <button
                  key={user.uid}
                  onClick={() => selectCreateChat(user)}
                  className="w-full flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition text-left cursor-pointer text-zinc-400 text-xs"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative">
                      <img src={user.photoURL} className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-zinc-900" alt="User avatar" />
                      {user.isOnline && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-zinc-950 rounded-full" />
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden text-xs">
                      <span className="text-zinc-300 font-bold truncate">{user.displayName}</span>
                      <span className="text-[9px] text-zinc-500 truncate">@{user.username}</span>
                    </div>
                  </div>
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-500 opacity-60 hover:opacity-100" />
                </button>
              ))
            )}
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: Active Chat Panel */}
      <div className="md:col-span-8 flex flex-col h-full bg-zinc-950/15 justify-between">
        {activeChatId && activePartner ? (
          <>
            {/* Conversations Header details */}
            <div className="px-5 py-4 border-b border-zinc-850 bg-zinc-950/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative cursor-pointer" onClick={() => onViewChange('profile', activePartner.username)}>
                  <img src={activePartner.photoURL} className="w-10 h-10 rounded-full object-cover border border-zinc-800" alt="Active partner" />
                  {activePartner.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border border-zinc-950 rounded-full" />
                  )}
                </div>

                <div className="flex flex-col text-xs text-left">
                  <div className="flex items-center gap-1">
                    <span 
                      onClick={() => onViewChange('profile', activePartner.username)} 
                      className="font-bold text-white hover:underline cursor-pointer"
                    >
                      {activePartner.displayName}
                    </span>
                    {activePartner.isVerified && <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400/20" />}
                  </div>
                  
                  {/* Realtime online status tracker */}
                  <span className="text-[10px] text-zinc-500">
                    {activePartner.isOnline ? (
                      <span className="text-emerald-400 font-semibold">● Online</span>
                    ) : (
                      'Inativo'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrolling messages pane */}
            <div className="flex-grow overflow-y-auto p-5 space-y-3.5" id="chat-messages-scroll-area">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-650 text-center gap-2">
                  <span className="text-xs italic">Nenhuma mensagem neste chat ainda. Comece enviando abaixo!</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === currentUser.uid;

                  return (
                    <div 
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isMe 
                          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-br-none shadow-lg shadow-cyan-500/5' 
                          : 'bg-zinc-900 text-zinc-200 rounded-bl-none'
                      }`}>
                        
                        {!isMe && (
                          <div className="text-[9px] text-zinc-500 font-bold block mb-1 font-mono">@{msg.senderUsername}</div>
                        )}

                        <p className="whitespace-pre-wrap select-text font-medium">{msg.content}</p>

                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-zinc-300 opacity-60">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && <CheckCheck className="w-3 h-3 text-cyan-300" />}
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat bottom action input form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-zinc-950/40 border-t border-zinc-850 flex items-center gap-3">
              <button type="button" className="p-2 text-zinc-500 hover:text-white transition">
                <Smile className="w-5 h-5 text-zinc-500" />
              </button>

              <input
                type="text"
                placeholder="Escreva sua mensagem em tempo real..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-cyan-500"
                id="message-text-input"
                required
              />

              <button
                type="submit"
                className="bg-cyan-500 text-white p-3 rounded-xl hover:opacity-95 hover:scale-105 active:scale-95 transition flex items-center justify-center cursor-pointer shadow-md shadow-cyan-500/15"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          /* Empty Active Panel view fallback */
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-8 text-center space-y-4">
            <MessageSquare className="w-14 h-14 text-zinc-800 animate-bounce" />
            <div>
              <h3 className="text-sm font-black text-zinc-300 block">Sua Central de Mensagens</h3>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-sm leading-relaxed">
                Escolha uma conversa existente na barra lateral esquerda ou clique em um usuário disponível para trocar mensagens em tempo real sem refresh!
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
