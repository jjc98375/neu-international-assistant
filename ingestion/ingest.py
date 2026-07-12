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

CATEGORIES = {
    "arrival": "Arrival",
    "billing": "Billing",
    "course": "Course Registration",
    "employment": "Employment",
    "forms": "forms",
    "scholarships": "Scholarships",
    "tuition": "Tuition&Fees",
    "visa": "Visa",
}

BASE_DIR = Path("./northeastern_docs")
COLLECTION = os.getenv("QDRANT_COLLECTION", "northeastern_docs")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def load_documents():
    documents = []
    for cat_key, folder in CATEGORIES.items():
        folder_path = BASE_DIR / folder
        if not folder_path.exists():
            print(f"  skip {folder!r}: folder not found")
            continue
        pdfs = list(folder_path.glob("**/*.pdf"))
        print(f"  {folder}: {len(pdfs)} PDFs")
        for pdf in pdfs:
            try:
                docs = PyPDFLoader(str(pdf)).load()
                for d in docs:
                    d.metadata.update(
                        {
                            "filename": pdf.name,
                            "folder": folder,
                            "category": cat_key,
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
    print("Creating payload index on metadata.category (required for category-filtered search)...")
    client.create_payload_index(
        collection_name=COLLECTION,
        field_name="metadata.category",
        field_schema=qmodels.PayloadSchemaType.KEYWORD,
    )

    points = client.get_collection(COLLECTION).points_count
    print(f"Done. Collection {COLLECTION!r} now holds {points} points.")


if __name__ == "__main__":
    main()
