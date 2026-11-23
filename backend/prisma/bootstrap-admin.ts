import "dotenv/config";
import { hashPassword } from "../src/auth.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Travora Administrator";
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in backend/.env before running admin:create.");
  if (password.length < 12) throw new Error("Bootstrap admin password must be at least 12 characters.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Account ${email} already exists with role ${existing.role}; no changes were made.`);
    return;
  }
  const admin = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password), role: "ADMIN" }, select: { id: true, name: true, email: true, role: true } });
  console.log("Admin account created:", admin);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
