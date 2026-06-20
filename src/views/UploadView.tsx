import { useState, ChangeEvent, FormEvent } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { STOCK_POSTS, STOCK_REELS } from '../constants';
import { 
  PlusSquare, 
  Film, 
  Sparkles, 
  FileImage, 
  FileVideo, 
  Compass, 
  Upload,
  CheckCircle2
} from 'lucide-react';

interface UploadViewProps {
  currentUser: any;
  userProfile: UserProfile | null;
  onViewChange: (view: string) => void;
}

export default function UploadView({ currentUser, userProfile, onViewChange }: UploadViewProps) {
  const [content, setContent] = useState('');
  const [isReel, setIsReel] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'none'>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Drag and drop base64 image/video compression handler
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1400000) { // Limit size to ~1.4MB for safe document sizing
        setError('O limite de upload no feed do navegador é de 1.4MB para armazenamento unificado.');
        return;
      }
      setIsUploading(true);
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaUrl(reader.result as string);
        setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
        setIsUploading(false);
      };
      reader.onerror = () => {
        setError('Algum problema ocorreu ao ler o arquivo.');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Populate pre-selected assets
  const selectStockTemplate = (url: string, cType: 'image' | 'video', text?: string) => {
    setMediaUrl(url);
    setMediaType(cType);
    if (text) {
      setContent(text);
    }
    setError('');
  };

  const handlePostSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaType === 'none') {
      setError('Por favor, escreva uma legenda ou anexe alguma mídia.');
      return;
    }
    if (!userProfile) {
      setError('Sua sessão de perfil não foi totalmente indexada.');
      return;
    }

    setLoading(true);
    setError('');

    // Parse hashtags dynamically from content
    const words = content.split(/[\s,]+/);
    const hashtags = words
      .filter(w => w.startsWith('#'))
      .map(w => w.trim().replace(/[^a-zA-Z0-9_#]/g, ''));

    try {
      await addDoc(collection(db, 'posts'), {
        userId: currentUser.uid,
        userDisplayName: userProfile.displayName,
        userUsername: userProfile.username,
        userPhotoURL: userProfile.photoURL,
        content: content.trim(),
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        likes: [],
        likesCount: 0,
        commentsCount: 0,
        hashtags: hashtags,
        isReel: isReel,
        viewsCount: isReel ? 1 : 0, // starts at 1 view
        createdAt: new Date().toISOString()
      });

      setSuccess('Publicação compartilhada com sucesso no JPvano!');
      setContent('');
      setMediaUrl('');
      setMediaType('none');
      
      // Redirect to feed after brief success pause
      setTimeout(() => {
        onViewChange(isReel ? 'reels' : 'feed');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Houve um erro ao enviar para a nuvem.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6" id="upload-panel-view">
      
      <div className="bg-zinc-900 border border-zinc-800/60 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-850 pb-4">
          <PlusSquare className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-lg font-black text-white">Criar Nova Publicação</h2>
            <p className="text-[10px] text-zinc-500">Sincronização imediata em múltiplos navegadores em tempo real</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-950/40 border border-red-800 text-red-400 rounded-xl text-xs text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800 text-emerald-400 rounded-xl text-xs text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        {/* 1. Toggle Post Type choice */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setIsReel(false);
              // reset media type since standard post can have none
            }}
            className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2 font-bold cursor-pointer ${
              !isReel 
                ? 'bg-cyan-950/30 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/5' 
                : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-xs">Post de Feed Padrão</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsReel(true);
              setMediaType('video'); // reel must be video
            }}
            className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2 font-bold cursor-pointer ${
              isReel 
                ? 'bg-rose-950/30 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/5' 
                : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white'
            }`}
          >
            <Film className="w-5 h-5" />
            <span className="text-xs">TikTok-style Reel</span>
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handlePostSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold ml-1">Legenda (Caption)</label>
            <textarea
              placeholder="Escreva algo inspirador... Use #hashtags para destacar nas tendências do JPvano!"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 rounded-2xl p-4 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-cyan-500 min-h-32 resize-none"
              id="upload-caption-input"
            />
          </div>

          {/* 2. Drag & Drop or Custom File input section */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 font-semibold ml-1">Mídia do Post (Foto ou Vídeo Curto)</label>
            
            <div className="border border-dashed border-zinc-800 hover:border-cyan-500 rounded-2xl p-6 bg-zinc-950 flex flex-col items-center justify-center text-center gap-2 transition relative overflow-hidden group">
              <Upload className="w-8 h-8 text-zinc-600 group-hover:text-cyan-400 transition" />
              <div className="text-xs">
                <span className="text-cyan-400 font-bold hover:underline cursor-pointer">Escolha um arquivo</span> ou arraste aqui
              </div>
              <span className="text-[9px] text-zinc-600 block mt-1">Imagens (.jpg, .png) ou vídeos (.mp4, max 1.4MB)</span>
              
              <input
                type="file"
                accept={isReel ? 'video/*' : 'image/*,video/*'}
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                id="post-media-file-uploader"
              />

              {isUploading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-xs">Aguarde... Carregando mídia...</div>
              )}
            </div>
          </div>

          {/* Media URL Direct Text Field option */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-600 block text-center uppercase tracking-wide">Ou digite uma URL direta</span>
            <input
              type="text"
              placeholder="https://exemplo.com/video-ou-foto.mp4"
              value={mediaUrl.startsWith('data:') ? '' : mediaUrl}
              onChange={(e) => {
                const val = e.target.value;
                setMediaUrl(val);
                if (val) {
                  setMediaType(val.toLowerCase().endsWith('.mp4') || isReel ? 'video' : 'image');
                } else {
                  setMediaType('none');
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-700"
            />
          </div>

          {/* 3. Visual Presets Selection Carousel */}
          <div className="space-y-2 pt-2 border-t border-zinc-850">
            <label className="text-[11px] text-zinc-500 font-bold block flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              <span>Deseja testar rápido? Escolha um Modelo Premium:</span>
            </label>

            <div className="flex gap-3 overflow-x-auto pb-1 mt-1">
              {!isReel ? (
                /* Post templates */
                STOCK_POSTS.map((sp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectStockTemplate(sp.url, 'image', sp.content)}
                    className="flex flex-col shrink-0 w-28 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden hover:opacity-80 active:scale-95 transition text-left text-[10px]"
                  >
                    <img src={sp.url} className="w-full h-16 object-cover" alt="Template" />
                    <span className="p-1 px-2 text-zinc-400 line-clamp-1 truncate">{sp.content}</span>
                  </button>
                ))
              ) : (
                /* Reel templates */
                STOCK_REELS.map((sr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectStockTemplate(sr.url, 'video', `${sr.title} ${sr.hashtags.join(' ')}`)}
                    className="flex flex-col shrink-0 w-28 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden hover:opacity-80 active:scale-95 transition text-left text-[10px]"
                  >
                    <video src={sr.url} className="w-full h-16 object-cover bg-black" muted preload="metadata" />
                    <span className="p-1 px-2 text-zinc-400 line-clamp-1 truncate">{sr.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 4. Active Preview card of attachment if chosen */}
          {mediaUrl && (
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-850 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-bold">Pré-visualização do Anexo:</span>
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrl('');
                    setMediaType('none');
                  }}
                  className="text-[10px] text-red-400 font-bold hover:underline"
                >
                  Remover Mídia
                </button>
              </div>

              <div className="max-h-56 overflow-hidden rounded-xl bg-black border border-zinc-800 flex items-center justify-center">
                {mediaType === 'video' ? (
                  <video src={mediaUrl} className="w-full max-h-56 object-contain" controls muted />
                ) : (
                  <img src={mediaUrl} className="w-full max-h-56 object-cover" alt="Chosen attachment" />
                )}
              </div>
            </div>
          )}

          {/* Submit Trigger */}
          <button
            type="submit"
            disabled={loading || isUploading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 py-3.5 rounded-xl font-bold text-xs tracking-wider text-white shadow-xl shadow-cyan-500/10 active:scale-[0.98] transition flex items-center justify-center"
            id="upload-submit-button"
          >
            {loading ? 'Sincronizando publicação na Nuvem...' : isReel ? 'Lançar Reel Vertical' : 'Compartilhar Post Global'}
          </button>
        </form>
      </div>
    </div>
  );
}
