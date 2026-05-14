import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var __colanMongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoClient(): Promise<MongoClient | null> {
  if (!uri) return null;
  if (!globalThis.__colanMongoClientPromise) {
    const client = new MongoClient(uri);
    globalThis.__colanMongoClientPromise = client.connect().then(() => client);
  }
  return globalThis.__colanMongoClientPromise;
}

export async function getDb(): Promise<Db | null> {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db(process.env.MONGODB_DB ?? "colan_teams");
}
