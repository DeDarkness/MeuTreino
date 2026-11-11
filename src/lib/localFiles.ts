/** Safari may consume the blob URL after the click has returned. */
export function downloadLocalFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export async function shareLocalFile(file: File) {
  const data = { files: [file] };
  if (!navigator.share || !navigator.canShare?.(data)) throw new Error('Compartilhamento indisponível aqui. Use Baixar arquivo.');
  // Call directly from the user's tap, with the file already prepared.
  await navigator.share(data);
}
