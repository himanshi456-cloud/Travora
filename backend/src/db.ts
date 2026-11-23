import { PrismaClient } from "@prisma/client";

// One Prisma Client instance is shared by the Express API.
export const prisma = new PrismaClient();
