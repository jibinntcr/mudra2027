/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb';
import seedSnapshot from './seed-snapshot.json';

type FilterDoc = Record<string, any>;

function matchesCondition(fieldVal: any, cond: any): boolean {
  if (
    cond &&
    typeof cond === 'object' &&
    !Array.isArray(cond) &&
    !(cond instanceof Date) &&
    !(cond instanceof ObjectId)
  ) {
    if ('$in' in cond && Array.isArray(cond.$in)) {
      if (Array.isArray(fieldVal)) {
        return fieldVal.some((v) => cond.$in.some((c: any) => String(v) === String(c)));
      }
      return cond.$in.some((c: any) => String(fieldVal) === String(c));
    }
    if ('$nin' in cond && Array.isArray(cond.$nin)) {
      if (Array.isArray(fieldVal)) {
        return !fieldVal.some((v) => cond.$nin.some((c: any) => String(v) === String(c)));
      }
      return !cond.$nin.some((c: any) => String(fieldVal) === String(c));
    }
    if ('$ne' in cond) {
      return String(fieldVal) !== String(cond.$ne);
    }
    if ('$gt' in cond) {
      return new Date(fieldVal).getTime() > new Date(cond.$gt).getTime();
    }
    if ('$gte' in cond) {
      return new Date(fieldVal).getTime() >= new Date(cond.$gte).getTime();
    }
    if ('$lt' in cond) {
      return new Date(fieldVal).getTime() < new Date(cond.$lt).getTime();
    }
    if ('$lte' in cond) {
      return new Date(fieldVal).getTime() <= new Date(cond.$lte).getTime();
    }
    if ('$exists' in cond) {
      const exists = fieldVal !== undefined && fieldVal !== null;
      return cond.$exists ? exists : !exists;
    }
    if ('$regex' in cond) {
      const flags = cond.$options || '';
      const re = new RegExp(String(cond.$regex), flags);
      if (Array.isArray(fieldVal)) {
        return fieldVal.some((v) => re.test(String(v || '')));
      }
      return re.test(String(fieldVal || ''));
    }
  }

  if (Array.isArray(fieldVal) && !Array.isArray(cond)) {
    return fieldVal.some((v) => String(v) === String(cond));
  }
  if (fieldVal instanceof ObjectId || cond instanceof ObjectId) {
    return String(fieldVal) === String(cond);
  }
  return fieldVal === cond;
}

function matchesFilter(doc: FilterDoc, filter: FilterDoc = {}): boolean {
  for (const [key, cond] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (key === '$and' && Array.isArray(cond)) {
      if (!cond.every((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (!matchesCondition(doc[key], cond)) {
      return false;
    }
  }
  return true;
}

function evaluateExpr(doc: FilterDoc, expr: any): any {
  if (typeof expr === 'string' && expr.startsWith('$')) {
    return doc[expr.slice(1)];
  }
  if (!expr || typeof expr !== 'object') return expr;
  if ('$ifNull' in expr && Array.isArray(expr.$ifNull)) {
    const v = evaluateExpr(doc, expr.$ifNull[0]);
    return v !== undefined && v !== null ? v : evaluateExpr(doc, expr.$ifNull[1]);
  }
  if ('$in' in expr && Array.isArray(expr.$in)) {
    const val = evaluateExpr(doc, expr.$in[0]);
    const list = expr.$in[1] || [];
    return Array.isArray(list) && list.includes(val);
  }
  if ('$regexMatch' in expr) {
    const input = String(evaluateExpr(doc, expr.$regexMatch.input) || '');
    const re = new RegExp(String(expr.$regexMatch.regex || ''), expr.$regexMatch.options || '');
    return re.test(input);
  }
  if ('$cond' in expr && Array.isArray(expr.$cond)) {
    const test = Boolean(evaluateExpr(doc, expr.$cond[0]));
    return test ? evaluateExpr(doc, expr.$cond[1]) : evaluateExpr(doc, expr.$cond[2]);
  }
  if ('$add' in expr && Array.isArray(expr.$add)) {
    return expr.$add.reduce(
      (sum: number, item: any) => sum + Number(evaluateExpr(doc, item) || 0),
      0
    );
  }
  return expr;
}

class InMemoryCursor<T> {
  private items: T[];
  constructor(items: T[]) {
    this.items = [...items];
  }
  sort(sortSpec: Record<string, 1 | -1>): this {
    this.items.sort((a: any, b: any) => {
      for (const [field, dir] of Object.entries(sortSpec)) {
        const av = a[field] instanceof Date ? a[field].getTime() : a[field];
        const bv = b[field] instanceof Date ? b[field].getTime() : b[field];
        if (av === bv) continue;
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        return (av > bv ? 1 : -1) * dir;
      }
      return 0;
    });
    return this;
  }
  skip(n: number): this {
    this.items = this.items.slice(n);
    return this;
  }
  limit(n: number): this {
    this.items = this.items.slice(0, n);
    return this;
  }
  async toArray(): Promise<T[]> {
    return this.items;
  }
}

export class InMemoryCollection<T extends FilterDoc> {
  private rows: T[];
  private uniqueKeys: string[][];
  constructor(initialRows: any[] = [], uniqueKeys: string[][] = []) {
    this.uniqueKeys = uniqueKeys;
    this.rows = initialRows.map((r) => ({
      ...r,
      _id: r._id ? new ObjectId(String(r._id)) : new ObjectId(),
      ...(r.userId && ObjectId.isValid(String(r.userId))
        ? { userId: String(r.userId) }
        : {}),
      ...(r.createdAt ? { createdAt: new Date(r.createdAt) } : {}),
      ...(r.updatedAt ? { updatedAt: new Date(r.updatedAt) } : {}),
      ...(r.expiresAt ? { expiresAt: new Date(r.expiresAt) } : {}),
      ...(r.documentDate ? { documentDate: new Date(r.documentDate) } : {}),
    })) as T[];
  }

  async createIndexes(): Promise<void> {}

  find(filter: FilterDoc = {}, options?: { projection?: Record<string, number> }): InMemoryCursor<T> {
    const matched = this.rows
      .filter((r) => matchesFilter(r, filter))
      .map((r) => {
        if (options?.projection) {
          const copy: any = { ...r };
          for (const [k, v] of Object.entries(options.projection)) {
            if (v === 0) delete copy[k];
          }
          return copy as T;
        }
        return { ...r };
      });
    return new InMemoryCursor<T>(matched);
  }

  async findOne(
    filter: FilterDoc = {},
    options?: { projection?: Record<string, number> }
  ): Promise<T | null> {
    const arr = await this.find(filter, options).limit(1).toArray();
    return arr[0] || null;
  }

  async countDocuments(filter: FilterDoc = {}): Promise<number> {
    return this.rows.filter((r) => matchesFilter(r, filter)).length;
  }

  async insertOne(doc: any): Promise<{ insertedId: ObjectId }> {
    for (const keySet of this.uniqueKeys) {
      const conflict = this.rows.some((r) =>
        keySet.every((k) => r[k] !== undefined && r[k] === doc[k])
      );
      if (conflict) {
        const err: any = new Error(`E11000 duplicate key error on ${keySet.join(',')}`);
        err.code = 11000;
        throw err;
      }
    }
    const _id = doc._id instanceof ObjectId ? doc._id : new ObjectId();
    this.rows.push({ ...doc, _id });
    return { insertedId: _id };
  }

  async updateOne(
    filter: FilterDoc,
    update: FilterDoc,
    options?: { upsert?: boolean }
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: ObjectId }> {
    const idx = this.rows.findIndex((r) => matchesFilter(r, filter));
    if (idx === -1) {
      if (options?.upsert) {
        const _id = new ObjectId();
        const newDoc: any = {
          _id,
          ...filter,
          ...(update.$setOnInsert || {}),
          ...(update.$set || {}),
        };
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            newDoc[k] = (Number(newDoc[k]) || 0) + Number(v);
          }
        }
        this.rows.push(newDoc);
        return { matchedCount: 0, modifiedCount: 0, upsertedId: _id };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }
    const target: any = { ...this.rows[idx] };
    if (update.$set) Object.assign(target, update.$set);
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        target[k] = (Number(target[k]) || 0) + Number(v);
      }
    }
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) {
        delete target[k];
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        const arr = Array.isArray(target[k]) ? [...target[k]] : [];
        arr.push(v);
        target[k] = arr;
      }
    }
    this.rows[idx] = target;
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async findOneAndUpdate(
    filter: FilterDoc,
    update: FilterDoc,
    options?: { returnDocument?: 'before' | 'after'; upsert?: boolean }
  ): Promise<T | null> {
    const idx = this.rows.findIndex((r) => matchesFilter(r, filter));
    if (idx === -1) {
      if (options?.upsert) {
        await this.updateOne(filter, update, { upsert: true });
        return this.rows[this.rows.length - 1];
      }
      return null;
    }
    const before = { ...this.rows[idx] };
    await this.updateOne(filter, update);
    return options?.returnDocument === 'before' ? before : { ...this.rows[idx] };
  }

  async updateMany(
    filter: FilterDoc,
    update: FilterDoc
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    let count = 0;
    for (let i = 0; i < this.rows.length; i++) {
      if (matchesFilter(this.rows[i], filter)) {
        count++;
        const target: any = { ...this.rows[i] };
        if (update.$set) Object.assign(target, update.$set);
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            target[k] = (Number(target[k]) || 0) + Number(v);
          }
        }
        this.rows[i] = target;
      }
    }
    return { matchedCount: count, modifiedCount: count };
  }

  async deleteOne(filter: FilterDoc = {}): Promise<{ deletedCount: number }> {
    const idx = this.rows.findIndex((r) => matchesFilter(r, filter));
    if (idx === -1) return { deletedCount: 0 };
    this.rows.splice(idx, 1);
    return { deletedCount: 1 };
  }

  async deleteMany(filter: FilterDoc = {}): Promise<{ deletedCount: number }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matchesFilter(r, filter));
    return { deletedCount: before - this.rows.length };
  }

  aggregate<R = any>(pipeline: FilterDoc[]): { toArray: () => Promise<R[]> } {
    return {
      toArray: async (): Promise<R[]> => {
        if (pipeline.some((stage) => '$search' in stage)) {
          throw new Error('Atlas $search not enabled on in-memory store');
        }
        let current: any[] = this.rows.map((r) => ({ ...r }));
        for (const stage of pipeline) {
          if ('$match' in stage) {
            current = current.filter((r) => matchesFilter(r, stage.$match));
          } else if ('$unwind' in stage) {
            const field = String(stage.$unwind).replace(/^\$/, '');
            const unwound: any[] = [];
            for (const row of current) {
              const arr = Array.isArray(row[field]) ? row[field] : [row[field]];
              for (const item of arr) {
                unwound.push({ ...row, [field]: item });
              }
            }
            current = unwound;
          } else if ('$group' in stage) {
            const idExpr = stage.$group._id;
            const groups = new Map<any, any>();
            for (const row of current) {
              const key =
                typeof idExpr === 'string' && idExpr.startsWith('$')
                  ? row[idExpr.slice(1)]
                  : idExpr;
              if (!groups.has(key)) {
                groups.set(key, { _id: key, count: 0 });
              }
              if (stage.$group.count) {
                groups.get(key).count += 1;
              }
            }
            current = Array.from(groups.values());
          } else if ('$addFields' in stage) {
            current = current.map((row) => {
              const next = { ...row };
              for (const [k, expr] of Object.entries(stage.$addFields)) {
                next[k] = evaluateExpr(next, expr);
              }
              return next;
            });
          } else if ('$sort' in stage) {
            current = await new InMemoryCursor(current).sort(stage.$sort).toArray();
          } else if ('$skip' in stage) {
            current = current.slice(Number(stage.$skip));
          } else if ('$limit' in stage) {
            current = current.slice(0, Number(stage.$limit));
          } else if ('$count' in stage) {
            current = [{ [stage.$count]: current.length }];
          } else if ('$facet' in stage) {
            const facetOut: Record<string, any> = {};
            for (const [facetName, subPipeline] of Object.entries(
              stage.$facet as Record<string, FilterDoc[]>
            )) {
              const tempCol = new InMemoryCollection(current);
              facetOut[facetName] = await tempCol.aggregate(subPipeline).toArray();
            }
            current = [facetOut];
          }
        }
        return current as R[];
      },
    };
  }
}

interface GlobalMemoryStore {
  memoryCols?: {
    users: InMemoryCollection<any>;
    sessions: InMemoryCollection<any>;
    rateLimits: InMemoryCollection<any>;
    categories: InMemoryCollection<any>;
    documents: InMemoryCollection<any>;
    importLogs: InMemoryCollection<any>;
    quizzes: InMemoryCollection<any>;
    quizVersions: InMemoryCollection<any>;
    quizRooms: InMemoryCollection<any>;
    quizParticipants: InMemoryCollection<any>;
    quizSubmissions: InMemoryCollection<any>;
    quizAttempts: InMemoryCollection<any>;
  };
}

const g = globalThis as unknown as GlobalMemoryStore;

export function getSeededMemoryCollections() {
  if (!g.memoryCols) {
    const snap = seedSnapshot as any;
    g.memoryCols = {
      users: new InMemoryCollection(snap.users || [], [['loginId']]),
      sessions: new InMemoryCollection([], [['tokenHash']]),
      rateLimits: new InMemoryCollection([], [['key']]),
      categories: new InMemoryCollection(snap.categories || [], [['slug']]),
      documents: new InMemoryCollection(snap.documents || [], [['docId'], ['slug']]),
      importLogs: new InMemoryCollection(snap.importLogs || [], [['runId']]),
      quizzes: new InMemoryCollection(snap.quizzes || [], [['quizId'], ['slug']]),
      quizVersions: new InMemoryCollection(snap.quizVersions || [], [['versionId']]),
      quizRooms: new InMemoryCollection(snap.quizRooms || [], [['roomCode']]),
      quizParticipants: new InMemoryCollection([], [['participantId']]),
      quizSubmissions: new InMemoryCollection([], [['roomCode', 'participantId', 'questionIndex']]),
      quizAttempts: new InMemoryCollection([], [['attemptId']]),
    };
  }
  return g.memoryCols;
}
