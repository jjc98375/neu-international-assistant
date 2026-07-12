# Ingestion (offline)

Builds the Qdrant Cloud collection the Assistant queries at runtime. Run only when the PDFs change. NOT deployed (see root `.vercelignore`).

## Run
```bash
cd ingestion
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# set OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY in a .env file here
python ingest.py
```

Embeds with `text-embedding-3-small` (1536d, cosine). The runtime query path in `src/lib/rag.ts` MUST use the same embedding model or vectors won't match.
