import { 
  Home, 
  Search, 
  Film, 
  PlusSquare, 
  MessageCircle, 
  User, 
  ShieldAlert, 
  LogOut, 
  Bell 
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isAdmin: boolean;
  onLogout: () => void;
  unreadCount: number;
  unseenNotificationsCount: number;
  userPhoto: string;
}

export default function Sidebar({
  currentView,
  onViewChange,
  isAdmin,
  onLogout,
  unreadCount,
  unseenNotificationsCount,
  userPhoto
}: SidebarProps) {
  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'explore', label: 'Explore', icon: Search },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'upload', label: 'Publicar', icon: PlusSquare },
    { id: 'messages', label: 'Mensagens', icon: MessageCircle, badge: unreadCount },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldAlert });
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 border-r border-zinc-800 bg-black p-6 z-30 justify-between">
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div 
            onClick={() => onViewChange('feed')} 
            className="cursor-pointer flex items-center gap-2 group"
            id="sidebar-logo"
          >
            <span className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
              JPvano
            </span>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
              v1.0
            </span>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => onViewChange(item.id)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-left relative group ${
                    isActive 
                      ? 'bg-zinc-900 text-cyan-400 font-semibold shadow-inner' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-950'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-6 h-6 transition-transform group-hover:scale-105 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-black px-1 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                  {isActive && (
                    <div className="absolute left-0 w-1 h-6 bg-cyan-400 rounded-r-md" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile / Logout Section at bottom */}
        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-6">
          <button 
            onClick={() => onViewChange('profile')} 
            className="flex items-center gap-3 p-2 hover:bg-zinc-900 rounded-xl transition text-left"
            id="nav-profile-bottom"
          >
            <img 
              src={userPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-800"
            />
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-zinc-200 truncate">Sua Conta</span>
              <span className="text-xs text-zinc-500 truncate">Ver Perfil</span>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-all duration-200 text-left"
            id="nav-item-logout"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-zinc-800 bg-black/95 backdrop-blur-md flex justify-around items-center px-2 py-1 z-30">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              id={`nav-item-mobile-${item.id}`}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center justify-center p-2 relative rounded-xl transition ${
                isActive ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6 stroke-2" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-black px-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
            </button>
          );
        })}
        
        {/* Mobile Profile Trigger */}
        <button
          onClick={() => onViewChange('profile')}
          className={`flex flex-col items-center justify-center p-2 relative rounded-xl transition ${
            currentView === 'profile' ? 'text-cyan-400' : 'text-zinc-500'
          }`}
          id="nav-item-mobile-profile"
        >
          <img 
            src={userPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
            alt="Avatar" 
            className={`w-6 h-6 rounded-full object-cover ${currentView === 'profile' ? 'ring-2 ring-cyan-400' : 'ring-1 ring-zinc-800'}`}
          />
          <span className="text-[9px] mt-0.5 font-medium">Perfil</span>
        </button>

        {/* Mobile Logout Button (compact inside profile or mini-icon if admin wants it, let's keep bottom bar uncluttered!) */}
      </nav>
    </>
  );
}
