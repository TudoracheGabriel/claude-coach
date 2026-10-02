const DEFAULT_WINDOW = 200_000;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

function usageTokens(usage) {
  const u = obj(usage);
  if (!u) return null;
  const parts = [u.input_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens].map(num);
  if (parts.every((p) => p === null)) return null;
  return parts.reduce((sum, p) => sum + (p ?? 0), 0);
}

function window(raw) {
  const w = obj(raw);
  if (!w) return null;
  const usedPercentage = num(w.used_percentage);
  const resetsAt = num(w.resets_at);
  if (usedPercentage === null) return null;
  return { usedPercentage, resetsAt: resetsAt === null ? null : resetsAt * 1000 };
}

// Turns whatever arrived on stdin into a stable snapshot. Every field may be missing.
export function normalize(input) {
  const i = obj(input) ?? {};
  const ctx = obj(i.context_window) ?? {};
  const windowSize = num(ctx.context_window_size) ?? DEFAULT_WINDOW;
  const pct = num(ctx.used_percentage);
  const fromUsage = usageTokens(ctx.current_usage);
  const tokens = fromUsage ?? (pct === null ? null : Math.round((pct / 100) * windowSize));
  const percent = pct ?? (tokens === null ? null : (tokens / windowSize) * 100);

  const cache = obj(i.prompt_cache);
  const limits = obj(i.rate_limits);
  const model = obj(i.model) ?? {};
  const workspace = obj(i.workspace) ?? {};

  return {
    sessionId: typeof i.session_id === 'string' && i.session_id ? i.session_id : 'unknown',
    promptId: typeof i.prompt_id === 'string' && i.prompt_id ? i.prompt_id : null,
    transcriptPath: typeof i.transcript_path === 'string' && i.transcript_path ? i.transcript_path : null,
    cwd: workspace.current_dir || i.cwd || null,
    model: typeof model.display_name === 'string' ? model.display_name : typeof model.id === 'string' ? model.id : null,
    effort: typeof obj(i.effort)?.level === 'string' ? i.effort.level : null,
    tokens,
    percent,
    windowSize,
    cache: cache
      ? {
          warm: cache.warm === true,
          expiresAt: num(cache.expires_at) === null ? null : cache.expires_at * 1000,
          recacheTokens: num(cache.recache_tokens_if_cold),
          hitRatio: num(cache.hit_ratio),
        }
      : null,
    limits: {
      fiveHour: window(limits?.five_hour),
      sevenDay: window(limits?.seven_day),
    },
  };
}
