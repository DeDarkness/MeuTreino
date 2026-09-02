import { Check, Download, ExternalLink, Film, Image as ImageIcon, Info, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import type { WallpaperAsset } from '../types';

type WallpaperScreenProps = {
  asset: WallpaperAsset | null;
  url: string | null;
  loading: boolean;
  error: string | null;
  onSave: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
};

const TOJI_SOURCE_URL = 'https://mylivewallpapers.com/anime/toji-fushiguro-jjk-live-wallpaper/';
const TOJI_DOWNLOAD_URL = 'https://mylivewallpapers.com/download/mobile-toji-fushiguro-jjk-live-wallpaper/';

export function WallpaperScreen({ asset, url, loading, error, onSave, onRemove }: WallpaperScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSave(file);
      setMessage(file.type.startsWith('video/') ? 'Vídeo aplicado em loop.' : 'Wallpaper aplicado.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível usar este arquivo.');
    } finally {
      setSaving(false);
    }
  };

  const clearWallpaper = async () => {
    if (!window.confirm('Remover o wallpaper personalizado e voltar ao fundo animado padrão?')) return;
    try {
      await onRemove();
      setMessage('Fundo animado padrão restaurado.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível remover o wallpaper.');
    }
  };

  return (
    <section className="screen wallpaper-screen" aria-labelledby="wallpaper-title">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Sua identidade</p>
          <h1 id="wallpaper-title">Wallpaper</h1>
          <p>Deixe o MeuTreino com a sua cara.</p>
        </div>
        <span className="wallpaper-screen__header-icon"><Sparkles /></span>
      </header>

      {(message || error) ? (
        <div className="toast-message" role="status">
          {message || error}
          <button type="button" aria-label="Fechar aviso" onClick={() => setMessage(null)}>×</button>
        </div>
      ) : null}

      <div className={`wallpaper-preview${asset ? ' has-custom' : ''}`}>
        {asset && url ? (
          asset.kind === 'video'
            ? <video key={url} src={url} autoPlay loop muted playsInline preload="metadata" />
            : <img src={url} alt="Prévia do wallpaper escolhido" />
        ) : (
          <div className="wallpaper-preview__aurora"><span /><span /><span /></div>
        )}
        <div className="wallpaper-preview__shade" />
        <div className="wallpaper-preview__ui">
          <div><span>MEUTREINO</span><strong>Vá além.</strong></div>
          <span className="wallpaper-preview__badge">M</span>
          <div className="wallpaper-preview__glass">
            <small>PRÓXIMO TREINO</small>
            <strong>Seu melhor treino começa aqui</strong>
          </div>
        </div>
        {asset?.kind === 'video' ? <span className="wallpaper-preview__loop"><Film size={14} /> LOOP</span> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,.mov,.m4v"
        hidden
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      <button
        className="button button-primary button-wide button-kinetic wallpaper-upload"
        type="button"
        disabled={loading || saving}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={20} /> {saving ? 'Salvando…' : asset ? 'Trocar wallpaper' : 'Escolher foto ou vídeo'}
      </button>

      <article className="wallpaper-featured">
        <div className="wallpaper-featured__art" aria-hidden="true">
          <span className="wallpaper-featured__moon" />
          <span className="wallpaper-featured__slash" />
          <strong>TOJI</strong>
          <small>JUJUTSU KAISEN</small>
        </div>
        <div className="wallpaper-featured__content">
          <p className="eyebrow">Pronto para usar</p>
          <h2>Toji Fushiguro JJK</h2>
          <span>Vídeo mobile · 2,4 MB · animação em loop</span>
          <div className="wallpaper-featured__actions">
            <a className="button button-secondary" href={TOJI_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              <Download size={17} /> 1. Baixar MP4
            </a>
            <button className="button button-primary" type="button" disabled={loading || saving} onClick={() => inputRef.current?.click()}>
              <Upload size={17} /> 2. Aplicar
            </button>
          </div>
          <a className="wallpaper-featured__source" href={TOJI_SOURCE_URL} target="_blank" rel="noreferrer">
            Ver página e créditos <ExternalLink size={13} />
          </a>
        </div>
      </article>

      <p className="wallpaper-featured__hint"><Info size={16} /> No iPhone, baixe o MP4, toque em <strong>Aplicar</strong> e selecione-o em Downloads. O MeuTreino salva uma cópia offline neste aparelho.</p>

      {asset ? (
        <div className="wallpaper-current">
          <span className="wallpaper-current__icon">{asset.kind === 'video' ? <Film /> : <ImageIcon />}</span>
          <div><strong>{asset.name}</strong><small>{asset.kind === 'video' ? 'Vídeo em loop e sem som' : 'Imagem de fundo'} · {formatBytes(asset.size)}</small></div>
          <Check className="wallpaper-current__check" />
        </div>
      ) : (
        <div className="wallpaper-current wallpaper-current--default">
          <span className="wallpaper-current__icon"><Sparkles /></span>
          <div><strong>Aurora dinâmica</strong><small>Wallpaper animado padrão do MeuTreino</small></div>
          <Check className="wallpaper-current__check" />
        </div>
      )}

      <div className="wallpaper-info-grid">
        <article><ImageIcon /><div><strong>Fotos e GIFs</strong><span>JPG, PNG, WebP, GIF e HEIC.</span></div></article>
        <article><Film /><div><strong>Vídeos em loop</strong><span>MP4, MOV, M4V e WebM, sem áudio.</span></div></article>
      </div>

      <p className="wallpaper-privacy"><Info size={17} /> O arquivo fica somente neste aparelho e não entra no backup JSON. Limite de 150 MB.</p>

      {asset ? (
        <button className="wallpaper-remove" type="button" onClick={() => void clearWallpaper()}>
          <Trash2 size={18} /> Voltar ao wallpaper padrão
        </button>
      ) : null}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
