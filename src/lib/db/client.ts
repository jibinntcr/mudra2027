import { MongoClient, Db, Collection } from 'mongodb';
import type {
  UserDocument,
  SessionDocument,
  RateLimitDocument,
  CategoryDocument,
  LibraryDocument,
  ImportLogDocument,
} from './types';
import { getSeededMemoryCollections } from './memory-store';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mudra_publications';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mudra_publications';

interface GlobalMongo {
  clientPromise?: Promise<MongoClient>;
  client?: MongoClient;
  mongoUnavailable?: boolean;
}

const globalWithMongo = globalThis as unknown as GlobalMongo;

export async function getMongoClient(): Promise<MongoClient> {
  if (!globalWithMongo.clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500,
    });
    globalWithMongo.client = client;
    globalWithMongo.clientPromise = client.connect();
  }
  return globalWithMongo.clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(MONGODB_DB_NAME);
}

export async function getCollections() {
  // When running on Vercel Serverless without an external MongoDB Atlas URI configured (defaulting to 127.0.0.1),
  // or if the MongoDB socket is unreachable, automatically fall back to the seeded snapshot store so all
  // 41 migrated Eaadharam documents, 18 categories, and subscriber accounts work seamlessly in the cloud.
  const isLocalUriOnCloud =
    Boolean(process.env.VERCEL) &&
    (!process.env.MONGODB_URI ||
      process.env.MONGODB_URI.includes('127.0.0.1') ||
      process.env.MONGODB_URI.includes('localhost'));

  if (!isLocalUriOnCloud && !globalWithMongo.mongoUnavailable) {
    try {
      const db = await getDb();
      return {
        db,
        users: db.collection<UserDocument>('users'),
        sessions: db.collection<SessionDocument>('sessions'),
        rateLimits: db.collection<RateLimitDocument>('rate_limits'),
        categories: db.collection<CategoryDocument>('categories'),
        documents: db.collection<LibraryDocument>('documents'),
        importLogs: db.collection<ImportLogDocument>('import_logs'),
      };
    } catch {
      globalWithMongo.mongoUnavailable = true;
    }
  }

  const mem = getSeededMemoryCollections();
  return {
    db: {
      listCollections: () => ({ toArray: async () => [] }),
      createCollection: async () => {},
      command: async () => {},
    } as unknown as Db,
    users: mem.users as unknown as Collection<UserDocument>,
    sessions: mem.sessions as unknown as Collection<SessionDocument>,
    rateLimits: mem.rateLimits as unknown as Collection<RateLimitDocument>,
    categories: mem.categories as unknown as Collection<CategoryDocument>,
    documents: mem.documents as unknown as Collection<LibraryDocument>,
    importLogs: mem.importLogs as unknown as Collection<ImportLogDocument>,
  };
}
