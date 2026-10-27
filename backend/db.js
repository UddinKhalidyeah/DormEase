
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Report connection errors without exposing credentials
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL connection error:", err.message);
});
