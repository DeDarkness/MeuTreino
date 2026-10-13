// Only a public URL belongs here. VAPID private keys stay in Cloudflare secrets.
export const PUSH_SERVICE_URL = import.meta.env.VITE_PUSH_SERVICE_URL || 'https://meutreino-push.meutreino-push.workers.dev';
