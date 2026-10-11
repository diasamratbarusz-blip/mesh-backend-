import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

const databaseName =
  process.env.MONGODB_DB || "mesh_network";

if (!uri) {
  throw new Error(
    "MONGODB_URI environment variable is missing."
  );
}

let clientPromise =
  globalThis.__meshMongoClientPromise;

if (!clientPromise) {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000
  });

  clientPromise = client.connect();

  globalThis.__meshMongoClientPromise =
    clientPromise;
}

export async function getDatabase() {
  const client = await clientPromise;

  const db = client.db(databaseName);

  return {
    db,
    nodes: db.collection("nodes"),
    links: db.collection("links")
  };
}
