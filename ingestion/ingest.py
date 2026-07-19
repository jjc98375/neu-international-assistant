"""
One-time ingestion: load PDFs from northeastern_docs/, chunk them,
embed with OpenAI, and upsert into a Qdrant Cloud collection.

Run locally whenever the docs change:

    python ingest.py

Env vars required (use a .env file):
    OPENAI_API_KEY
    QDRANT_URL
    QDRANT_API_KEY
    QDRANT_COLLECTION   (optional, defaults to "northeastern_docs")
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

load_dotenv()

# Five runtime categories (keys MUST match src/lib/rag-categories.ts), each fed by
# one or more folders on disk. Folder names predate the 2026-07 consolidation:
# Arrival + forms merged into "visa", Tuition&Fees into "billing".
CATEGORIES = {
    "billing": ["Billing", "Tuition&Fees"],
    "course": ["Course Registration"],
    "employment": ["Employment"],
    "scholarships": ["Scholarships"],
    "visa": ["Visa", "Arrival", "forms"],
}

# Campus tagging (mirrors src/lib/campuses.ts): PDFs directly in a category
# folder get the category's default region tag; PDFs inside a campus subfolder
# (e.g. Scholarships/Toronto/) get that subfolder's tag. The runtime filter
# matches metadata.campus against {campus key, region, "all"}.
CATEGORY_DEFAULT_CAMPUS = {
    "billing": "us",       # SFS/NUSHP pages are US-campus billing
    "course": "all",       # registrar/calendar apply network-wide
    "employment": "us",    # OGS work-authorization docs are F-1/US
    "scholarships": "all",
    "visa": "us",          # OGS immigration docs are F-1/US
}
CAMPUS_FOLDERS = {
    "boston": "boston",
    "seattle": "seattle",
    "silicon valley": "silicon-valley",
    "oakland": "oakland",
    "toronto": "toronto",
    "vancouver": "vancouver",
    "canada": "canada",
    "london": "london",
    "us": "us",
}

BASE_DIR = Path("./northeastern_docs")
COLLECTION = os.getenv("QDRANT_COLLECTION", "northeastern_docs")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def load_documents():
    documents = []
    for cat_key, folders in CATEGORIES.items():
        for folder in folders:
            folder_path = BASE_DIR / folder
            if not folder_path.exists():
                print(f"  skip {folder!r}: folder not found")
                continue
            pdfs = list(folder_path.glob("**/*.pdf"))
            print(f"  {folder} -> {cat_key}: {len(pdfs)} PDFs")
            for pdf in pdfs:
                rel = pdf.relative_to(folder_path)
                campus = CATEGORY_DEFAULT_CAMPUS[cat_key]
                if len(rel.parts) > 1:
                    campus = CAMPUS_FOLDERS.get(rel.parts[0].lower(), campus)
                try:
                    docs = PyPDFLoader(str(pdf)).load()
                    for d in docs:
                        d.metadata.update(
                            {
                                "filename": pdf.name,
                                "folder": folder,
                                "category": cat_key,
                                "campus": campus,
                                "source": str(pdf),
                            }
                        )
                    documents.extend(docs)
                except Exception as e:
                    print(f"    failed {pdf.name}: {e}")
    return documents


def recreate_collection(client: QdrantClient):
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION in existing:
        print(f"Deleting existing collection {COLLECTION!r}")
        client.delete_collection(COLLECTION)

    print(f"Creating collection {COLLECTION!r} (dim={EMBEDDING_DIM}, cosine)")
    client.create_collection(
        collection_name=COLLECTION,
        vectors_config=qmodels.VectorParams(
            size=EMBEDDING_DIM,
            distance=qmodels.Distance.COSINE,
        ),
    )


def main():
    print("Loading PDFs...")
    documents = load_documents()
    print(f"Loaded {len(documents)} pages total.")
    if not documents:
        print("No documents found. Aborting.")
        return

    print("Chunking...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    )
    chunks = splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks.")

    client = QdrantClient(
        url=os.environ["QDRANT_URL"],
        api_key=os.environ["QDRANT_API_KEY"],
    )
    recreate_collection(client)

    print("Embedding + uploading to Qdrant (this calls the OpenAI embeddings API)...")
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    QdrantVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        url=os.environ["QDRANT_URL"],
        api_key=os.environ["QDRANT_API_KEY"],
        collection_name=COLLECTION,
    )

    # Qdrant requires a payload index on any field used in a filter.
    # The runtime query path filters on metadata.category, so index it here.
    print("Creating payload indexes on metadata.category / metadata.campus (required for filtered search)...")
    for field in ("metadata.category", "metadata.campus"):
        client.create_payload_index(
            collection_name=COLLECTION,
            field_name=field,
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )

    points = client.get_collection(COLLECTION).points_count
    print(f"Done. Collection {COLLECTION!r} now holds {points} points.")


if __name__ == "__main__":
    main()
