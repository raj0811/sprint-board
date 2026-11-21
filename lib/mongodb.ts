import "server-only";
import { MongoClient } from "mongodb";

const uri = process.env.DB;
if (!uri) throw new Error("The DB environment variable is required.");

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

const client = global.mongoClientPromise ?? new MongoClient(uri).connect();
if (process.env.NODE_ENV !== "production") global.mongoClientPromise = client;

export async function getDatabase() {
  const connectedClient = await client;
  return connectedClient.db(process.env.DB_NAME);
}
