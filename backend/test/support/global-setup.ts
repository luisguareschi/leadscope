import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./test-env.js";

/** Applies the migrations to the test database once per run. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
}
