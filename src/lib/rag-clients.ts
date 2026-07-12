// src/lib/rag-clients.ts
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

let _openai: OpenAI | null = null;
let _qdrant: QdrantClient | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: required("OPENAI_API_KEY") });
  return _openai;
}

export function getQdrant(): QdrantClient {
  if (!_qdrant) {
    _qdrant = new QdrantClient({
      url: required("QDRANT_URL"),
      apiKey: required("QDRANT_API_KEY"),
    });
  }
  return _qdrant;
}

export const COLLECTION = process.env.QDRANT_COLLECTION || "northeastern_docs";
