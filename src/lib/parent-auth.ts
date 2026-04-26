// Parent-account auth — local-only, password-hashed via PBKDF2-SHA-256.
// Replaces the Phase 1 hardcoded PIN. See compliance/posture.md for the
// data-handling decisions this implements.

import type { ParentAccount } from "@/types";
import { db } from "./db";

const PBKDF2_ITERATIONS = 200_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  // Allocate a fresh ArrayBuffer (not the SharedArrayBuffer-typed default)
  // so this is assignable to crypto.subtle's BufferSource parameter under
  // strict TypeScript.
  const buffer = new ArrayBuffer(s.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes as Uint8Array<ArrayBuffer>;
}

function randomSaltB64(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return bufToB64(bytes.buffer);
}

async function deriveHashB64(
  password: string,
  saltB64: string,
  iterations: number
): Promise<string> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: b64ToBuf(saltB64),
      iterations,
    },
    passwordKey,
    HASH_BITS
  );
  return bufToB64(bits);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface PasswordPolicy {
  ok: boolean;
  reasons: string[];
}

// Tight on length, lenient on character mix — kids' parents shouldn't be
// fighting a regex. Length is the dominant security factor anyway.
export function validatePassword(password: string): PasswordPolicy {
  const reasons: string[] = [];
  if (password.length < 8) {
    reasons.push("Use at least 8 characters.");
  }
  if (password.length > 200) {
    reasons.push("Keep it under 200 characters.");
  }
  return { ok: reasons.length === 0, reasons };
}

export function validateEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function hasAnyParentAccount(): Promise<boolean> {
  const count = await db.parents.count();
  return count > 0;
}

export async function getParentAccount(
  email: string
): Promise<ParentAccount | undefined> {
  return db.parents.get(normalizeEmail(email));
}

export async function createParentAccount(
  email: string,
  password: string
): Promise<ParentAccount> {
  const normalized = normalizeEmail(email);
  if (!validateEmail(normalized)) {
    throw new Error("Please enter a valid email address.");
  }
  const policy = validatePassword(password);
  if (!policy.ok) {
    throw new Error(policy.reasons.join(" "));
  }
  const existing = await db.parents.get(normalized);
  if (existing) {
    throw new Error("An account with that email already exists.");
  }
  const salt = randomSaltB64();
  const passwordHash = await deriveHashB64(password, salt, PBKDF2_ITERATIONS);
  const account: ParentAccount = {
    email: normalized,
    passwordHash,
    salt,
    iterations: PBKDF2_ITERATIONS,
    createdAt: Date.now(),
    lastLoginAt: null,
  };
  await db.parents.add(account);
  return account;
}

export async function verifyParentLogin(
  email: string,
  password: string
): Promise<ParentAccount | null> {
  const normalized = normalizeEmail(email);
  const account = await db.parents.get(normalized);
  if (!account) return null;
  const candidate = await deriveHashB64(
    password,
    account.salt,
    account.iterations
  );
  // Constant-time-ish compare. Both are base64 of fixed-length bytes,
  // so we use a length-checked equality rather than Array.from + reduce
  // tricks — JS-side timing leaks aren't meaningfully defendable, so the
  // simple comparison is the right tradeoff.
  if (candidate.length !== account.passwordHash.length) return null;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i++) {
    mismatch |= candidate.charCodeAt(i) ^ account.passwordHash.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  const updated: ParentAccount = { ...account, lastLoginAt: Date.now() };
  await db.parents.put(updated);
  return updated;
}

export async function deleteParentAccount(email: string): Promise<void> {
  await db.parents.delete(normalizeEmail(email));
}
