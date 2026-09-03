import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.env.CITYDEFENSE_SEED_PASSWORD;
if (!password || password.length < 12 || password.length > 160) {
  throw new Error(
    "Set CITYDEFENSE_SEED_PASSWORD to a 12-160 character value before running this command.",
  );
}

const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 120_000, 32, "sha256")
  .toString("hex");

process.stdout.write(`${salt}:${hash}\n`);
