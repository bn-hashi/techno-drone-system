import path from "node:path";

export default {
  schema: path.join("prisma", "schema.prisma"),
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const { Pool } = await import("pg");

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is not set");
      }

      const pool = new Pool({
        connectionString: databaseUrl,
      });
      return new PrismaPg(pool);
    },
  },
};
