import { MongoClient, Db, Collection } from 'mongodb';
import type {
  UserDocument,
  SessionDocument,
  RateLimitDocument,
  CategoryDocument,
  LibraryDocument,
  ImportLogDocument,
} from './types';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mudra_publications';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mudra_publications';

interface GlobalMongo {
  clientPromise?: Promise<MongoClient>;
  client?: MongoClient;
}

const globalWithMongo = globalThis as unknown as GlobalMongo;

export async function getMongoClient(): Promise<MongoClient> {
  if (!globalWithMongo.clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 2,
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
}
