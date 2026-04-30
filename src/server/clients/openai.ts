import OpenAI from "openai";
import { env } from "~/env";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  _client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _client;
}

const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 1024;

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("OpenAI returned empty embedding data");
  }
  return embedding;
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return generateEmbedding(query);
}
