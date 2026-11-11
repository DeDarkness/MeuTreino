import { useEffect, useState } from 'react';
import { ProgressPhotoImage } from '../components/ProgressPhotoImage';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { addProgressPhoto, deleteProgressPhoto, listProgressPhotos } from '../lib/database';
import { PHOTO_POSES, prepareProgressPhoto, type PhotoPose, type ProgressPhoto } from '../lib/progressPhotos';
import { downloadLocalFile } from '../lib/localFiles';
import { LocalForm, Field, SaveButton } from '../nutrition/FormControls';
import { localDate, validDate } from '../nutrition/engine';
import type { BodyMeasurement } from '../nutrition/types';
import { dateLabel, stringValue } from '../nutrition/uiHelpers';
import './photo-evolution.css';

const photoLabel = (photo: ProgressPhoto) => `${dateLabel(photo.date)} · ${PHOTO_POSES[photo.pose]}`;
const photoOption = (photo: ProgressPhoto) => `${photoLabel(photo)} · registrada às ${new Date(photo.createdAt).toLocaleTimeString('pt-BR')}`;

export function PhotoEvolution({ measurements }: { measurements: BodyMeasurement[] }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [formVersion, setFormVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const [opened, setOpened] = useState<ProgressPhoto | null>(null);
  const [filter, setFilter] = useState<PhotoPose | ''>('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listProgressPhotos().then((saved) => { if (!cancelled) setPhotos(saved); })
      .catch(() => { if (!cancelled) setNotice('Não foi possível carregar as fotos do aparelho.'); });
    return () => { cancelled = true; };
  }, []);

  const visible = photos.filter((photo) => !filter || filter === photo.pose)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const save = async (data: FormData) => {
    const camera = data.get('camera');
    const gallery = data.get('gallery');
    const sources = [camera, gallery].filter((item): item is File => item instanceof File && item.size > 0);
    if (sources.length !== 1) throw new Error('Escolha uma foto pela câmera ou pela galeria.');
    const date = stringValue(data, 'date');
    const pose = stringValue(data, 'pose') as PhotoPose;
    if (!validDate(date) || date > localDate() || !Object.hasOwn(PHOTO_POSES, pose)) throw new Error('Confira a data e a pose.');
    const now = new Date().toISOString();
    const measurementId = stringValue(data, 'measurement');
    const photo: ProgressPhoto = {
      id: crypto.randomUUID(), date, pose, notes: stringValue(data, 'notes'),
      ...(measurementId ? { measurementId } : {}), createdAt: now, updatedAt: now,
      ...await prepareProgressPhoto(sources[0]),
    };
    await addProgressPhoto(photo);
    setPhotos((items) => [...items, photo]);
    setFormVersion((value) => value + 1);
    setNotice('Foto salva neste aparelho.');
  };
  const remove = async (photo: ProgressPhoto) => {
    if (deleting || !window.confirm(`Excluir a foto de ${photoLabel(photo)}?`)) return;
    setDeleting(true);
    try {
      await deleteProgressPhoto(photo.id);
      setPhotos((items) => items.filter((item) => item.id !== photo.id));
      setOpened(null);
      setNotice('Foto excluída.');
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Falha ao excluir a foto.'); }
    finally { setDeleting(false); }
  };
  return <>
    <article className="nutrition-card">
      <h2>Adicionar fotografia</h2>
      <LocalForm key={formVersion} onSave={save}>
        <div className="nutrition-form-grid">
          <label>Câmera<input name="camera" type="file" accept="image/*" capture="environment" /></label>
          <label>Galeria<input name="gallery" type="file" accept="image/*" /></label>
          <label>Data da foto<input name="date" type="date" defaultValue={localDate()} max={localDate()} required /></label>
          <label>Pose<select name="pose">{Object.entries(PHOTO_POSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Avaliação corporal<select name="measurement"><option value="">Sem associação</option>
            {measurements.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.date)}{item.measuredAt ? ` · ${new Date(item.measuredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</option>)}
          </select></label>
        </div>
        <Field name="notes" label="Observações" type="textarea" />
        <SaveButton label="Salvar foto no aparelho" />
      </LocalForm>
      {notice ? <p role="status">{notice}</p> : null}
    </article>
    {photos.length ? <article className="nutrition-card">
      <h2>Galeria de evolução</h2>
      <label>Pose<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
        <option value="">Todas as poses</option>
        {Object.entries(PHOTO_POSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {visible.length ? <div className="progress-photo-gallery">
        {visible.map((photo) => <button key={photo.id} type="button" onClick={() => setOpened(photo)}>
          <ProgressPhotoImage blob={photo.thumbnail} alt="" loading="lazy" />
          <span>{photoLabel(photo)}</span>
        </button>)}
      </div> : <p>Sem fotos nesta pose.</p>}
    </article> : null}
    {visible.length > 1 ? <PhotoComparison photos={visible} /> : null}
    {opened ? <PhotoViewer photo={opened} onClose={() => setOpened(null)} onDelete={() => void remove(opened)} deleting={deleting} /> : null}
  </>;
}

function PhotoComparison({ photos }: { photos: ProgressPhoto[] }) {
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [mode, setMode] = useState<'side' | 'slider' | 'overlay'>('side');
  const [position, setPosition] = useState(50);
  const first = photos.find((photo) => photo.id === firstId) ?? photos[1];
  const second = photos.find((photo) => photo.id === secondId) ?? photos[0];
  return <article className="nutrition-card">
    <h2>Comparar fotografias</h2>
    <div className="nutrition-form-grid">
      <label>Primeira foto<select value={first.id} onChange={(event) => setFirstId(event.target.value)}>
        {photos.map((photo) => <option key={photo.id} value={photo.id}>{photoOption(photo)}</option>)}
      </select></label>
      <label>Segunda foto<select value={second.id} onChange={(event) => setSecondId(event.target.value)}>
        {photos.map((photo) => <option key={photo.id} value={photo.id}>{photoOption(photo)}</option>)}
      </select></label>
      <label>Visualização<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
        <option value="side">Lado a lado</option><option value="slider">Divisor deslizante</option><option value="overlay">Sobreposição</option>
      </select></label>
    </div>
    {first.id === second.id ? <p>Selecione duas fotos diferentes.</p> : <>
      {mode !== 'side' ? <label>{mode === 'slider' ? 'Posição do divisor' : 'Opacidade da segunda foto'} · {position}%
        <input type="range" min={0} max={100} value={position} onChange={(event) => setPosition(Number(event.target.value))} />
      </label> : null}
      <div className={`progress-photo-comparison ${mode === 'side' ? 'is-side' : 'is-stacked'}`}>
        <div><ProgressPhotoImage blob={first.image} alt={photoLabel(first)} /></div>
        <div style={mode === 'overlay' ? { opacity: position / 100 } : mode === 'slider' ? { clipPath: `inset(0 0 0 ${position}%)` } : undefined}>
          <ProgressPhotoImage blob={second.image} alt={photoLabel(second)} />
        </div>
        {mode === 'slider' ? <span className="photo-divider" style={{ left: `${position}%` }} aria-hidden="true" /> : null}
      </div>
    </>}
  </article>;
}

function PhotoViewer({ photo, onClose, onDelete, deleting }: { photo: ProgressPhoto; onClose: () => void; onDelete: () => void; deleting: boolean }) {
  const dialog = useDialogFocus(onClose);
  const [zoom, setZoom] = useState(100);
  return <div className="workout-summary-backdrop">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="photo-view-title" tabIndex={-1} className="workout-summary-dialog">
      <h2 id="photo-view-title">{photoLabel(photo)}</h2>
      <button type="button" className="button button-secondary" onClick={onClose}>Fechar foto</button>
      <label className="photo-zoom">Ampliação · {zoom}%<input type="range" min={100} max={250} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
      <div className="photo-inspect"><div style={{ width: `${zoom}%` }}><ProgressPhotoImage blob={photo.image} alt={photoLabel(photo)} /></div></div>
      {photo.notes ? <p>{photo.notes}</p> : null}
      <button type="button" className="button button-secondary" onClick={() => downloadLocalFile(new File([photo.image],
        `MeuTreino-${photo.date}-${photo.pose}-${photo.id.slice(0, 8)}.jpg`, { type: photo.image.type }))}>Baixar foto</button>
      <button type="button" className="button button-secondary" disabled={deleting} onClick={onDelete}>Excluir foto</button>
    </section>
  </div>;
}
