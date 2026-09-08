// src/app/api/health/route.ts
import { getQdrant, COLLECTION } from "@/lib/rag-clients";

/**
 * Liveness probe for the corpus, and the target of the daily Vercel cron.
 *
 * The cron exists because the Qdrant free tier reaps clusters that sit idle,
 * and it has already happened twice on this project — each time the symptom
 * was every `/api/assistant` call failing while the env vars still looked
 * perfectly valid. A once-a-day read keeps the cluster counted as active.
 *
 * Route Handlers are uncached by default in this Next version, so each cron
 * firing really does reach Qdrant rather than replaying a stored response.
 */
export async function GET() {
  try {
    const info = await getQdrant().getCollection(COLLECTION);
    return Response.json({
      ok: true,
      collection: info.status,
      points: info.points_count ?? null,
    });
  } catch (err) {
    // The driver puts the cluster URL — and sometimes the api key — into its
    // error text, so log it server-side and hand the caller a bare status.
    console.error("health: qdrant unreachable", err);
    return Response.json({ ok: false, error: "corpus_unreachable" }, { status: 503 });
  }
}
