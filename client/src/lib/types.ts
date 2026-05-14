/**
 * UNWITNESSED — Type Definitions
 */

export type RoomType = '1v1' | 'group';

export interface RoomConfig {
  roomType: RoomType;
  maxUsers: number;
  password: string;
}

export interface RoomInfo {
  roomId: string;
  roomType: RoomType;
  maxUsers: number;
  currentUsers: number;
  createdAt: number;
}

export interface Peer {
  id: string;
  alias: string;
  publicKey: string;  // base64-encoded X25519 public key
}

export interface ChatMessage {
  id: string;
  senderAlias: string;
  senderPublicKey: string;
  content: string;        // decrypted content (client-side only)
  timestamp: number;
  isOwn: boolean;
  isSystem?: boolean;
}

export interface EncryptedChatMessage {
  id: string;
  senderAlias: string;
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  timestamp: number;
}

export interface SystemMessage {
  id: string;
  content: string;
  timestamp: number;
  isSystem: true;
  senderAlias: 'SYSTEM';
  isOwn: false;
}

// WebSocket Events
export interface WSCreateRoom {
  type: 'create_room';
  roomType: RoomType;
  maxUsers: number;
  passwordHash: string;
  publicKey: string;
  alias: string;
}

export interface WSJoinRoom {
  type: 'join_room';
  roomId: string;
  passwordHash: string;
  publicKey: string;
  alias: string;
}

export interface WSMessage {
  type: 'message';
  roomId: string;
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  senderAlias: string;
  timestamp: number;
  messageId: string;
}

export interface WSLeaveRoom {
  type: 'leave_room';
  roomId: string;
}

export interface WSServerResponse {
  type: 'room_created' | 'room_joined' | 'user_joined' | 'user_left' | 
        'message' | 'error' | 'room_destroyed' | 'peer_list';
  [key: string]: unknown;
}

export interface ExportedChat {
  messages: ChatMessage[];
  roomType: RoomType;
  exportedAt: number;
  participantCount: number;
}
