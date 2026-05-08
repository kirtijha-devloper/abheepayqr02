import { PrismaClient } from "@prisma/client";
import { resolveDatabaseConfig } from "./utils/env";

const databaseConfig = resolveDatabaseConfig();

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseConfig.url,
    },
  },
});

export const activeDatabaseTarget = databaseConfig.target;
