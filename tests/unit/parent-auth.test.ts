import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParentAccount } from "@/types";

// In-memory shim for the parents Dexie table — same pattern as
// progressStore.test.ts. We mock the whole `db` object rather than the
// individual helpers so the lib's calls to db.parents.* work.
const parentsStore = new Map<string, ParentAccount>();

vi.mock("@/lib/db", () => ({
  db: {
    parents: {
      count: async () => parentsStore.size,
      get: async (email: string) => parentsStore.get(email),
      add: async (p: ParentAccount) => {
        parentsStore.set(p.email, p);
      },
      put: async (p: ParentAccount) => {
        parentsStore.set(p.email, p);
      },
      delete: async (email: string) => {
        parentsStore.delete(email);
      },
    },
  },
}));

const {
  createParentAccount,
  verifyParentLogin,
  hasAnyParentAccount,
  validatePassword,
  validateEmail,
  deleteParentAccount,
} = await import("@/lib/parent-auth");

describe("parent-auth", () => {
  beforeEach(() => {
    parentsStore.clear();
  });

  it("validatePassword enforces length only (8-200)", () => {
    expect(validatePassword("short").ok).toBe(false);
    expect(validatePassword("longenough").ok).toBe(true);
    expect(validatePassword("a".repeat(201)).ok).toBe(false);
  });

  it("validateEmail accepts standard shapes and rejects garbage", () => {
    expect(validateEmail("parent@example.com")).toBe(true);
    expect(validateEmail("  PARENT@example.com ")).toBe(true);
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("missing@tld")).toBe(false);
  });

  it("createParentAccount stores a hash, not the plaintext password", async () => {
    const account = await createParentAccount(
      "parent@example.com",
      "hunter2-but-longer"
    );
    expect(account.email).toBe("parent@example.com");
    expect(account.passwordHash).not.toContain("hunter2");
    expect(account.passwordHash.length).toBeGreaterThan(20);
    expect(account.salt.length).toBeGreaterThan(10);
    expect(account.iterations).toBeGreaterThanOrEqual(100_000);
  });

  it("createParentAccount rejects duplicate emails (case-insensitive)", async () => {
    await createParentAccount("Parent@Example.com", "longenough123");
    await expect(
      createParentAccount("parent@example.com", "anotherpassword")
    ).rejects.toThrow(/already exists/i);
  });

  it("createParentAccount rejects bad email and short password", async () => {
    await expect(
      createParentAccount("nope", "longenough123")
    ).rejects.toThrow(/email/i);
    await expect(
      createParentAccount("parent@example.com", "short")
    ).rejects.toThrow(/8 characters/i);
  });

  it("verifyParentLogin succeeds with the right password", async () => {
    await createParentAccount("parent@example.com", "longenough123");
    const result = await verifyParentLogin(
      "parent@example.com",
      "longenough123"
    );
    expect(result).not.toBeNull();
    expect(result?.email).toBe("parent@example.com");
    expect(result?.lastLoginAt).not.toBeNull();
  });

  it("verifyParentLogin rejects wrong password", async () => {
    await createParentAccount("parent@example.com", "longenough123");
    expect(
      await verifyParentLogin("parent@example.com", "wrongpassword")
    ).toBeNull();
  });

  it("verifyParentLogin returns null for unknown email", async () => {
    expect(
      await verifyParentLogin("ghost@example.com", "longenough123")
    ).toBeNull();
  });

  it("hasAnyParentAccount reflects the table state", async () => {
    expect(await hasAnyParentAccount()).toBe(false);
    await createParentAccount("parent@example.com", "longenough123");
    expect(await hasAnyParentAccount()).toBe(true);
    await deleteParentAccount("parent@example.com");
    expect(await hasAnyParentAccount()).toBe(false);
  });

  it("two accounts with the same password get different hashes (salts work)", async () => {
    const a = await createParentAccount("a@example.com", "samepasswordforboth");
    const b = await createParentAccount("b@example.com", "samepasswordforboth");
    expect(a.passwordHash).not.toBe(b.passwordHash);
    expect(a.salt).not.toBe(b.salt);
  });
});
