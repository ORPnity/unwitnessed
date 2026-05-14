/**
 * UNWITNESSED — End-to-End Encryption Module
 * 
 * Uses tweetnacl (libsodium-compatible) for:
 * - X25519 ECDH key exchange
 * - XSalsa20-Poly1305 authenticated encryption (equivalent security to AES-256-GCM)
 * - Cryptographic random number generation
 * 
 * The server NEVER sees plaintext messages.
 * All encryption/decryption happens client-side only.
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedMessage {
  ciphertext: string;  // base64-encoded
  nonce: string;       // base64-encoded  
  senderPublicKey: string;  // base64-encoded
}

export interface EncryptedExport {
  version: number;
  salt: string;
  nonce: string;
  ciphertext: string;
  timestamp: number;
}

// ═══════════════════════════════════════════
// KEY GENERATION
// ═══════════════════════════════════════════

/**
 * Generate a new X25519 keypair for ECDH key exchange
 */
export function generateKeyPair(): KeyPair {
  return nacl.box.keyPair();
}

/**
 * Generate a cryptographically secure Room ID
 * Format: XXXX-XXXX-XXXX-XXXX (hex, 64 bits of entropy)
 */
export function generateRoomId(): string {
  const bytes = nacl.randomBytes(8);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`.toUpperCase();
}

/**
 * Generate a random user alias (anonymous identifier)
 * e.g., "ANON-7F3A"
 */
export function generateAlias(): string {
  const bytes = nacl.randomBytes(2);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `ANON-${hex}`;
}

// ═══════════════════════════════════════════
// MESSAGE ENCRYPTION (E2E using nacl.box)
// ═══════════════════════════════════════════

/**
 * Encrypt a message for a specific recipient using ECDH + XSalsa20-Poly1305
 * 
 * @param message - Plaintext message
 * @param recipientPublicKey - Recipient's X25519 public key
 * @param senderSecretKey - Sender's X25519 secret key
 * @returns EncryptedMessage with ciphertext, nonce, and sender public key
 */
export function encryptMessage(
  message: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array,
  senderPublicKey: Uint8Array
): EncryptedMessage {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(message);
  
  const ciphertext = nacl.box(
    messageBytes,
    nonce,
    recipientPublicKey,
    senderSecretKey
  );

  if (!ciphertext) {
    throw new Error('Encryption failed');
  }

  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    senderPublicKey: encodeBase64(senderPublicKey),
  };
}

/**
 * Decrypt a message from a specific sender using ECDH + XSalsa20-Poly1305
 * 
 * @param encrypted - EncryptedMessage object
 * @param recipientSecretKey - Recipient's X25519 secret key
 * @returns Decrypted plaintext string, or null if decryption fails
 */
export function decryptMessage(
  encrypted: EncryptedMessage,
  recipientSecretKey: Uint8Array
): string | null {
  try {
    const ciphertext = decodeBase64(encrypted.ciphertext);
    const nonce = decodeBase64(encrypted.nonce);
    const senderPublicKey = decodeBase64(encrypted.senderPublicKey);

    const plaintext = nacl.box.open(
      ciphertext,
      nonce,
      senderPublicKey,
      recipientSecretKey
    );

    if (!plaintext) {
      return null;
    }

    return encodeUTF8(plaintext);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// SHARED SECRET ENCRYPTION (for group chats)
// Uses nacl.secretbox with a shared key derived from room password
// ═══════════════════════════════════════════

/**
 * Derive a symmetric encryption key from a room password.
 * 
 * For ROOM encryption: called WITHOUT explicit salt → uses a deterministic salt 
 * derived from the password itself, ensuring all users with the same password 
 * derive the SAME key.
 * 
 * For EXPORT encryption: called WITH an explicit random salt → each export 
 * has its own unique salt stored alongside the ciphertext.
 */
export function deriveKeyFromPassword(password: string, salt?: Uint8Array): { key: Uint8Array; salt: Uint8Array } {
  // For room key derivation (no salt provided): derive salt deterministically
  // from the password so ALL users with the same password get the SAME key.
  const actualSalt = salt || nacl.hash(decodeUTF8('UNWITNESSED_ROOM_SALT_' + password)).slice(0, 16);
  
  // PBKDF-like key derivation using nacl.hash (SHA-512)
  // Hash password + salt multiple times for key stretching
  let derived = decodeUTF8(password + encodeBase64(actualSalt));
  for (let i = 0; i < 10000; i++) {
    derived = nacl.hash(derived);
  }
  
  // Take first 32 bytes as the key (for secretbox which uses XSalsa20-Poly1305)
  const key = derived.slice(0, nacl.secretbox.keyLength);
  
  return { key, salt: actualSalt };
}

/**
 * Encrypt a message with a shared symmetric key (for group chats)
 */
export function encryptWithSharedKey(
  message: string,
  sharedKey: Uint8Array
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = decodeUTF8(message);
  
  const ciphertext = nacl.secretbox(messageBytes, nonce, sharedKey);
  
  if (!ciphertext) {
    throw new Error('Encryption failed');
  }
  
  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a message with a shared symmetric key (for group chats)
 */
export function decryptWithSharedKey(
  ciphertext: string,
  nonce: string,
  sharedKey: Uint8Array
): string | null {
  try {
    const ciphertextBytes = decodeBase64(ciphertext);
    const nonceBytes = decodeBase64(nonce);
    
    const plaintext = nacl.secretbox.open(ciphertextBytes, nonceBytes, sharedKey);
    
    if (!plaintext) {
      return null;
    }
    
    return encodeUTF8(plaintext);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// CHAT EXPORT / IMPORT ENCRYPTION
// ═══════════════════════════════════════════

/**
 * Encrypt chat data for local export
 * Uses a user-provided password with a RANDOM salt (not the deterministic room salt)
 */
export function encryptExport(
  chatData: object,
  password: string
): EncryptedExport {
  // Use a random salt for exports (stored alongside ciphertext in the .enc file)
  const exportSalt = nacl.randomBytes(16);
  const { key, salt } = deriveKeyFromPassword(password, exportSalt);
  const plaintext = JSON.stringify(chatData);
  const { ciphertext, nonce } = encryptWithSharedKey(plaintext, key);
  
  return {
    version: 1,
    salt: encodeBase64(salt),
    nonce,
    ciphertext,
    timestamp: Date.now(),
  };
}

/**
 * Decrypt an imported chat export
 */
export function decryptExport(
  exportData: EncryptedExport,
  password: string
): object | null {
  try {
    const salt = decodeBase64(exportData.salt);
    const { key } = deriveKeyFromPassword(password, salt);
    const plaintext = decryptWithSharedKey(exportData.ciphertext, exportData.nonce, key);
    
    if (!plaintext) return null;
    
    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// PASSWORD HASHING (for room authentication)
// ═══════════════════════════════════════════

/**
 * Hash a room password for server-side verification
 * Server only stores the hash, never the plaintext password
 */
export function hashPassword(password: string): string {
  const passwordBytes = decodeUTF8(password);
  const hash = nacl.hash(passwordBytes);
  return encodeBase64(hash);
}

// ═══════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Encode a public key to base64 for transmission
 */
export function encodeKey(key: Uint8Array): string {
  return encodeBase64(key);
}

/**
 * Decode a base64 public key
 */
export function decodeKey(key: string): Uint8Array {
  return decodeBase64(key);
}

/**
 * Generate random bytes for various purposes
 */
export function randomBytes(length: number): Uint8Array {
  return nacl.randomBytes(length);
}

/**
 * Generate a visual representation of encrypted data (for UI display)
 */
export function generateEncryptedPreview(length: number = 40): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(){}[]|;:,.<>?';
  const bytes = nacl.randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}
