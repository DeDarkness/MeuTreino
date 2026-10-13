import { mkdir, writeFile, access } from 'node:fs/promises';
import webpush from 'web-push';

// Generated credentials are deliberately excluded from Git and console output.
const secretsDirectory = new URL('../.secrets/', import.meta.url);
const secretsFile = new URL('vapid.json', secretsDirectory);
try {
  await access(secretsFile);
  console.log('As chaves já existem. Elas foram preservadas.');
} catch {
  const keys = webpush.generateVAPIDKeys();
  await mkdir(secretsDirectory, { recursive: true });
  await writeFile(secretsFile, JSON.stringify({
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  }), { flag: 'wx', mode: 0o600 });
  console.log('Chaves geradas em arquivo local ignorado pelo Git. Nenhuma chave foi exibida.');
}
