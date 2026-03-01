/**
 * Supabase Edge Function: validate-key
 * Deploy:  supabase functions deploy validate-key
 *
 * POST { key: string }
 * → { valid: true }
 * → { valid: false, reason: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DAILY_REQUEST_LIMIT = 50;

interface RequestBody {
    key: string;
}

interface BetaKey {
    id: string;
    key: string;
    is_active: boolean;
    request_count: number;
    last_seen: string | null;
}

interface RateLimit {
    key: string;
    requests_today: number;
    window_start: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
    // Only allow POST
    if (req.method !== 'POST') {
        return json({ valid: false, reason: 'Method not allowed' }, 405);
    }

    let body: RequestBody;
    try {
        body = await req.json() as RequestBody;
    } catch {
        return json({ valid: false, reason: 'Invalid JSON body' }, 400);
    }

    const { key } = body;
    if (!key || typeof key !== 'string' || key.trim() === '') {
        return json({ valid: false, reason: 'No key provided' }, 400);
    }

    try {
        // RLS is disabled — anon key is sufficient for all reads and writes
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SB_ANON_KEY') ?? '',
        );

        // ── 1. Look up the key ────────────────────────────────────────────────────
        const { data: betaKey, error: lookupError } = await supabase
            .from('beta_keys')
            .select('id, key, is_active, request_count, last_seen')
            .eq('key', key)
            .single<BetaKey>();

        if (lookupError || !betaKey) {
            console.log('Lookup error:', JSON.stringify(lookupError));
            return json({ valid: false, reason: 'Invalid key' });
        }

        // ── 2. Check is_active ────────────────────────────────────────────────────
        if (!betaKey.is_active) {
            return json({ valid: false, reason: 'Key is not active' });
        }

        // ── 3. Check / update rate limit window ──────────────────────────────────
        const now = new Date();

        const { data: rl, error: rlError } = await supabase
            .from('rate_limits')
            .select('key, requests_today, window_start')
            .eq('key', key)
            .single<RateLimit>();

        // If rate_limits table doesn't exist, skip rate limiting
        if (rlError && rlError.code === 'PGRST205') {
            console.log('rate_limits table not found, skipping rate limiting');
            // Still update beta_keys
            await supabase
                .from('beta_keys')
                .update({
                    request_count: betaKey.request_count + 1,
                    last_seen: now.toISOString(),
                })
                .eq('key', key);
            return json({ valid: true });
        }

        const windowStart = rl ? new Date(rl.window_start) : now;
        const windowExpired =
            now.getTime() - windowStart.getTime() >= 24 * 60 * 60 * 1000;
        const requestsToday = rl && !windowExpired ? rl.requests_today : 0;

        if (requestsToday >= DAILY_REQUEST_LIMIT) {
            return json({ valid: false, reason: 'Daily request limit reached' });
        }

        // ── 4. Upsert rate_limits ─────────────────────────────────────────────────
        await supabase.from('rate_limits').upsert(
            {
                key,
                requests_today: windowExpired ? 1 : requestsToday + 1,
                window_start: windowExpired ? now.toISOString() : (rl?.window_start ?? now.toISOString()),
            },
            { onConflict: 'key' },
        );

        // ── 5. Update beta_keys (request_count + last_seen) ───────────────────────
        await supabase
            .from('beta_keys')
            .update({
                request_count: betaKey.request_count + 1,
                last_seen: now.toISOString(),
            })
            .eq('key', key);

        return json({ valid: true });
    } catch (err) {
        console.error('Unhandled error:', err);
        return json({ valid: false, reason: 'Internal error' }, 500);
    }
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
