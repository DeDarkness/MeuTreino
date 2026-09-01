import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function readProjectKey(
  keyMapVariable: string,
  singleKeyVariable: string,
  legacyVariable: string,
): string | null {
  const serializedKeyMap = Deno.env.get(keyMapVariable);
  if (serializedKeyMap) {
    try {
      const keyMap = JSON.parse(serializedKeyMap) as Record<string, unknown>;
      const defaultKey = keyMap.default;
      if (typeof defaultKey === 'string' && defaultKey.trim()) return defaultKey;
    } catch {
      console.error(`${keyMapVariable} is not valid JSON`);
    }
  }

  return Deno.env.get(singleKeyVariable) ?? Deno.env.get(legacyVariable) ?? null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const accessToken = authorization.slice('Bearer '.length).trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publicKey = readProjectKey(
    'SUPABASE_PUBLISHABLE_KEYS',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
  );
  const adminKey = readProjectKey(
    'SUPABASE_SECRET_KEYS',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  );

  if (!supabaseUrl || !publicKey || !adminKey) {
    console.error('delete-account is missing required server environment variables');
    return jsonResponse({ ok: false, error: 'server_not_configured' }, 500);
  }

  const userClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const adminClient = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deletionError } = await adminClient.auth.admin.deleteUser(
    userData.user.id,
    false,
  );

  if (deletionError) {
    console.error('delete-account failed', deletionError.message);
    return jsonResponse({ ok: false, error: 'deletion_failed' }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
