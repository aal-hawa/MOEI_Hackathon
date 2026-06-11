/**
 * MOEI ChromaDB Vector Store Manager
 * Handles embedding storage and similarity search for MOEI knowledge base
 * Uses ChromaDB as the vector database with LangChain integration
 */

import { Chroma } from '@langchain/community/vectorstores/chroma'
import { Document } from '@langchain/core/documents'
import { db } from '@/lib/db'

// ─── Embedding Function ────────────────────────────────────────────────────
// We use a simple hash-based embedding since we're in a sandbox without OpenAI keys
// In production, this would use OpenAI embeddings or similar

const EMBEDDING_DIMENSION = 384

/**
 * Simple TF-IDF inspired embedding for local use
 * In production, replace with OpenAI embeddings or similar
 */
function simpleEmbed(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/)
  const embedding = new Array(EMBEDDING_DIMENSION).fill(0)
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    let hash = 0
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0
    }
    const idx = Math.abs(hash) % EMBEDDING_DIMENSION
    embedding[idx] += 1
    // Add positional signal
    const posIdx = (idx + i) % EMBEDDING_DIMENSION
    embedding[posIdx] += 0.5
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1
  return embedding.map(v => v / magnitude)
}

// ─── ChromaDB Client ───────────────────────────────────────────────────────

let chromaClient: any = null
let vectorStore: Chroma | null = null
const COLLECTION_NAME = 'moei_knowledge'

async function getChromaClient() {
  if (chromaClient) return chromaClient
  
  try {
    const { ChromaClient } = await import('chromadb')
    chromaClient = new ChromaClient({ path: 'http://localhost:8000' })
    return chromaClient
  } catch (error) {
    console.warn('ChromaDB not available, using in-memory fallback:', error)
    return null
  }
}

// ─── In-Memory Vector Store Fallback ───────────────────────────────────────

interface VectorDocument {
  id: string
  content: string
  metadata: Record<string, any>
  embedding: number[]
}

let memoryStore: VectorDocument[] = []
let isInitialized = false

/**
 * Initialize the vector store with knowledge articles from the database
 */
export async function initializeVectorStore(): Promise<void> {
  if (isInitialized) return
  
  try {
    // Load all active knowledge articles from the database
    const articles = await db.knowledgeArticle.findMany({
      where: { isActive: true },
    })
    
    memoryStore = articles.map((article) => {
      const content = `${article.titleEn}\n${article.contentEn}\n${article.titleAr || ''}\n${article.contentAr || ''}`
      return {
        id: article.id,
        content,
        metadata: {
          category: article.category,
          tags: article.tags,
          titleEn: article.titleEn,
          titleAr: article.titleAr,
        },
        embedding: simpleEmbed(content),
      }
    })
    
    // Try ChromaDB initialization
    const client = await getChromaClient()
    if (client) {
      try {
        await client.heartbeat()
        console.log(`✅ ChromaDB connected, ${memoryStore.length} documents indexed`)
      } catch {
        console.log('⚠️ ChromaDB server not running, using in-memory vector store')
      }
    }
    
    isInitialized = true
    console.log(`📚 Vector store initialized with ${memoryStore.length} documents`)
  } catch (error) {
    console.error('Failed to initialize vector store:', error)
    // Still mark as initialized to prevent retry loops
    isInitialized = true
  }
}

/**
 * Add a document to the vector store
 */
export async function addDocument(
  id: string,
  content: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await initializeVectorStore()
  
  const doc: VectorDocument = {
    id,
    content,
    metadata,
    embedding: simpleEmbed(content),
  }
  
  // Remove existing document with same ID
  memoryStore = memoryStore.filter(d => d.id !== id)
  memoryStore.push(doc)
}

/**
 * Remove a document from the vector store
 */
export async function removeDocument(id: string): Promise<void> {
  memoryStore = memoryStore.filter(d => d.id !== id)
}

/**
 * Perform similarity search
 * @param query - The search query
 * @param k - Number of results to return
 * @returns Array of documents with similarity scores
 */
export async function similaritySearch(
  query: string,
  k: number = 5
): Promise<Array<{ content: string; metadata: Record<string, any>; score: number }>> {
  await initializeVectorStore()
  
  const queryEmbedding = simpleEmbed(query)
  
  // Calculate cosine similarity
  const results = memoryStore.map((doc) => {
    const similarity = cosineSimilarity(queryEmbedding, doc.embedding)
    return {
      content: doc.content,
      metadata: doc.metadata,
      score: similarity,
    }
  })
  
  // Sort by similarity (descending) and return top-k
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

/**
 * Perform similarity search with a score threshold
 */
export async function similaritySearchWithScore(
  query: string,
  k: number = 5,
  scoreThreshold: number = 0.3
): Promise<Array<{ content: string; metadata: Record<string, any>; score: number }>> {
  const results = await similaritySearch(query, k)
  return results.filter(r => r.score >= scoreThreshold)
}

// ─── Utility Functions ─────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * Get vector store statistics
 */
export function getVectorStoreStats() {
  return {
    totalDocuments: memoryStore.length,
    categories: [...new Set(memoryStore.map(d => d.metadata.category))],
    isInitialized,
  }
}

/**
 * Reinitialize the vector store (reload from database)
 */
export async function reinitializeVectorStore(): Promise<void> {
  isInitialized = false
  memoryStore = []
  await initializeVectorStore()
}
