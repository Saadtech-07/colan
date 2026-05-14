import { MongoClient, type Db } from "mongodb";

function mongoUri(): string {
  return (process.env.MONGODB_URI ?? "").trim();
}

declare global {
  // eslint-disable-next-line no-var
  var __colanMongoClientPromise: Promise<MongoClient> | undefined;
}

/** True when a non-empty connection string is present (does not guarantee connectivity). */
export function isMongoConfigured(): boolean {
  return mongoUri().length > 0;
}

export async function getMongoClient(): Promise<MongoClient | null> {
  const uri = mongoUri();
  if (!uri) return null;

  if (!globalThis.__colanMongoClientPromise) {
    const client = new MongoClient(uri);
    globalThis.__colanMongoClientPromise = client
      .connect()
      .then(() => client)
      .catch((err) => {
        globalThis.__colanMongoClientPromise = undefined;
        throw err;
      });
  }
  return globalThis.__colanMongoClientPromise;
}

export async function getDb(): Promise<Db | null> {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db(process.env.MONGODB_DB?.trim() || "colan_teams");
}
