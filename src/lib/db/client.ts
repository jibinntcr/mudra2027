import { MongoClient, Db, Collection } from 'mongodb';
import type {
  UserDocument,
  SessionDocument,
  RateLimitDocument,
  CategoryDocument,
  LibraryDocument,
  ImportLogDocument,
  QuizDocument,
  QuizVersionDocument,
  QuizRoomDocument,
  QuizParticipantDocument,
  QuizSubmissionDocument,
  QuizAttemptDocument,
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
      maxPoolSize: 40,
      minPoolSize: 2,
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
        quizzes: db.collection<QuizDocument>('quizzes'),
        quizVersions: db.collection<QuizVersionDocument>('quiz_versions'),
        quizRooms: db.collection<QuizRoomDocument>('quiz_rooms'),
        quizParticipants: db.collection<QuizParticipantDocument>('quiz_participants'),
        quizSubmissions: db.collection<QuizSubmissionDocument>('quiz_submissions'),
        quizAttempts: db.collection<QuizAttemptDocument>('quiz_attempts'),
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
    quizzes: mem.quizzes as unknown as Collection<QuizDocument>,
    quizVersions: mem.quizVersions as unknown as Collection<QuizVersionDocument>,
    quizRooms: mem.quizRooms as unknown as Collection<QuizRoomDocument>,
    quizParticipants: mem.quizParticipants as unknown as Collection<QuizParticipantDocument>,
    quizSubmissions: mem.quizSubmissions as unknown as Collection<QuizSubmissionDocument>,
    quizAttempts: mem.quizAttempts as unknown as Collection<QuizAttemptDocument>,
  };
}
