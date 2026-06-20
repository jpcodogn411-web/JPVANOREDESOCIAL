import { useState, ChangeEvent, FormEvent } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { DEFAULT_AVATARS } from '../constants';
import { KeyRound, Mail, User, Image, FileText, Sparkles, Check } from 'lucide-react';

interface AuthViewProps {
  onSuccess: () => void;
}

export default function AuthView({ onSuccess }: AuthViewProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(DEFAULT_AVATARS[0]);
  const [customPhoto, setCustomPhoto] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // File drag & drop to base64 upload
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // Limit size to ~800KB for Firestore documents safety
        setError('A imagem do avatar deve ter menos de 800KB para armazenamento em nuvem.');
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhoto(reader.result as string);
        setIsUploading(false);
        setError('');
      };
      reader.onerror = () => {
        setError('Ocorreu um erro ao ler o arquivo de imagem.');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Por favor, preencha o e-mail e a senha.');
      setLoading(false);
      return;
    }

    if (isRegister) {
      if (!username || !displayName) {
        setError('Por favor, defina um nome de exibição e nome de usuário.');
        setLoading(false);
        return;
      }
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername.length < 3) {
        setError('O nome de usuário deve conter no mínimo 3 caracteres alfanuméricos ou underline.');
        setLoading(false);
        return;
      }

      try {
        // Create user in firebase auth
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // Determine if this is a super admin email (both jpvanoredesocial@gmail.com and jpcodogn411@gmail.com)
        const isSuperAdmin = email.trim().toLowerCase() === 'jpvanoredesocial@gmail.com' || email.trim().toLowerCase() === 'jpcodogn411@gmail.com';

        // Save profile metadata in Firestore users collection
        const finalPhoto = customPhoto.trim() || selectedPhoto;
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: email.trim(),
          username: cleanUsername,
          displayName: displayName.trim(),
          photoURL: finalPhoto,
          bio: bio.trim() || 'No bio yet. Olá, sou novo no JPvano!',
          isVerified: isSuperAdmin, // Autofill verified badge for super admin
          isAdmin: isSuperAdmin,     // Promote fixed admin role
          isBanned: false,
          followersCount: 0,
          followingCount: 0,
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          isOnline: true
        });

        onSuccess();
      } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/email-already-in-use') {
          setError('Este e-mail já está em uso.');
        } else if (err.code === 'auth/weak-password') {
          setError('A senha deve ter pelo menos 6 caracteres.');
        } else if (err.code === 'auth/operation-not-allowed') {
          setError('⚠️ O provedor de login "E-mail/Senha" está desativado no Firebase. Ative-o em seu console do Firebase: Authentication > Sign-in method > Email/Password, ative e salve!');
        } else {
          setError(err.message || 'Erro durante o cadastro.');
        }
      }
    } else {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onSuccess();
      } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Credenciais incorretas ou usuário não encontrado.');
        } else if (err.code === 'auth/operation-not-allowed') {
          setError('⚠️ O provedor de login "E-mail/Senha" está desativado no Firebase. Ative-o em seu console do Firebase: Authentication > Sign-in method > Email/Password, ative e salve!');
        } else {
          setError(err.message || 'Erro ao efetuar login.');
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-8 relative overflow-hidden" id="auth-container">
      {/* Dynamic Glow Circles */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative z-10 shadow-2xl">
        {/* Header Block */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent mb-2">
            JPvano
          </h1>
          <p className="text-xs text-zinc-500">
            {isRegister 
              ? 'Conecte-se com o mundo em tempo real!' 
              : 'Instagram + TikTok + Twitter no mesmo lugar'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-400 text-xs text-center" id="auth-error">
            {error}
          </div>
        )}



        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium ml-1">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                id="auth-input-email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium ml-1">Senha</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                id="auth-input-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>
          </div>

          {isRegister && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium ml-1">Nome de Usuário (@)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="auth-input-username"
                    placeholder="ex: jp_mendes"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium ml-1">Nome de Exibição (Tela)</label>
                <div className="relative">
                  <Sparkles className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="auth-input-displayname"
                    placeholder="ex: João Paulo"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium ml-1">Biografia (Bio)</label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <textarea
                    id="auth-input-bio"
                    placeholder="Diga um pouco sobre você..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors h-16 resize-none"
                  />
                </div>
              </div>

              {/* Advanced Avatar Customization */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/40">
                <label className="text-xs text-zinc-400 font-medium block">Foto do Perfil</label>
                
                {/* Visual Circle Preview */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={customPhoto.trim() || selectedPhoto} 
                      alt="Preview" 
                      className="w-16 h-16 rounded-full object-cover border border-zinc-700 ring-2 ring-cyan-500/20"
                    />
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-[10px] text-white">Carregando...</div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5Packed">
                    <span className="text-[10px] text-zinc-500 block">Escolha uma predefinição abaixo ou envie seu próprio arquivo:</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                      id="avatar-file-upload"
                    />
                  </div>
                </div>

                {/* Preset Avatars Selection Carousel */}
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 mt-2">
                  {DEFAULT_AVATARS.map((avatar, idx) => {
                    const isSelected = selectedPhoto === avatar && !customPhoto;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedPhoto(avatar);
                          setCustomPhoto('');
                        }}
                        className={`w-9 h-9 rounded-full object-cover cursor-pointer relative shrink-0 overflow-hidden ring-offset-2 ring-offset-zinc-900 transition ${
                          isSelected ? 'ring-2 ring-cyan-400' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={avatar} className="w-full h-full object-cover" alt="Preset" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-cyan-500/40 flex items-center justify-center text-white">
                            <Check className="w-4 h-4 text-white font-bold stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <label className="text-[10px] text-zinc-500 block">Ou digite uma URL de Imagem personalizada:</label>
                  <div className="relative mt-1">
                    <Image className="w-3.5 h-3.5 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="https://exemplo.com/foto.jpg"
                      value={customPhoto}
                      onChange={(e) => setCustomPhoto(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-3 text-[10px] text-white placeholder-zinc-700 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            id="auth-submit-button"
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 active:scale-[0.98] py-3.5 rounded-xl font-bold text-xs tracking-wider text-white shadow-xl shadow-cyan-500/10 transition-all flex items-center justify-center"
            disabled={loading || isUploading}
          >
            {loading ? 'Dando o play...' : isRegister ? 'Cadastrar Conta' : 'Entrar na Rede'}
          </button>
        </form>

        {/* View Switch Trigger */}
        <div className="mt-6 text-center border-t border-zinc-800/60 pt-4">
          <p className="text-xs text-zinc-500">
            {isRegister ? 'Já é da família?' : 'Ainda não é cadastrado?'}
            <button
              onClick={() => setIsRegister(!isRegister)}
              id="auth-switch-mode-button"
              className="text-cyan-400 font-semibold ml-1 hover:underline text-xs cursor-pointer focus:outline-none"
            >
              {isRegister ? 'Entre Aqui' : 'Crie sua Conta'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
