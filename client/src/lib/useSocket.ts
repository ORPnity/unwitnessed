/**
 * UNWITNESSED — WebSocket Client Hook
 * Manages connection to the signaling server
 */

'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { Peer, ChatMessage, RoomInfo } from './types';
import {
  generateKeyPair,
  generateAlias,
  hashPassword,
  encryptWithSharedKey,
  decryptWithSharedKey,
  deriveKeyFromPassword,
  encodeKey,
  KeyPair,
} from './crypto';

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3001';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseSocketReturn {
  connectionState: ConnectionState;
  roomInfo: RoomInfo | null;
  messages: ChatMessage[];
  peers: Peer[];
  myAlias: string;
  myPublicKey: string;
  createRoom: (password: string, roomType: '1v1' | 'group', maxUsers: number) => void;
  joinRoom: (roomId: string, password: string) => void;
  sendMessage: (content: string) => void;
  leaveRoom: () => void;
  error: string | null;
  clearError: () => void;
}

export function useSocket(): UseSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const keyPairRef = useRef<KeyPair | null>(null);
  const sharedKeyRef = useRef<Uint8Array | null>(null);
  const aliasRef = useRef<string>(generateAlias());
  // Use a ref for the message handler to avoid stale closures
  const handleMessageRef = useRef<(data: any) => void>(() => {});
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Generate keypair on mount
  useEffect(() => {
    keyPairRef.current = generateKeyPair();
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderAlias: 'SYSTEM',
      senderPublicKey: '',
      content,
      timestamp: Date.now(),
      isOwn: false,
      isSystem: true,
    };
    setMessages(prev => [...prev, msg]);
  }, []);

  // Keep handleMessageRef always pointing to the latest handler
  useEffect(() => {
    handleMessageRef.current = (data: any) => {
      switch (data.type) {
        case 'room_created': {
          setRoomInfo({
            roomId: data.roomId,
            roomType: data.roomType,
            maxUsers: data.maxUsers,
            currentUsers: 1,
            createdAt: Date.now(),
          });
          addSystemMessage(`Room created. ID: ${data.roomId}`);
          addSystemMessage(`Type: ${data.roomType.toUpperCase()} | Max users: ${data.maxUsers}`);
          addSystemMessage('Waiting for peers to join...');
          break;
        }

        case 'room_joined': {
          setRoomInfo({
            roomId: data.roomId,
            roomType: data.roomType,
            maxUsers: data.maxUsers,
            currentUsers: data.currentUsers,
            createdAt: Date.now(),
          });
          
          if (data.peers) {
            setPeers(data.peers.map((p: any) => ({
              id: p.publicKey,
              alias: p.alias,
              publicKey: p.publicKey,
            })));
          }
          
          addSystemMessage(`Joined room ${data.roomId}`);
          addSystemMessage(`Users: ${data.currentUsers}/${data.maxUsers}`);
          break;
        }

        case 'user_joined': {
          setPeers(prev => [...prev, {
            id: data.publicKey,
            alias: data.alias,
            publicKey: data.publicKey,
          }]);
          setRoomInfo(prev => prev ? { ...prev, currentUsers: data.currentUsers } : null);
          addSystemMessage(`${data.alias} connected. [${data.currentUsers}/${data.maxUsers}]`);
          break;
        }

        case 'user_left': {
          setPeers(prev => prev.filter(p => p.alias !== data.alias));
          setRoomInfo(prev => prev ? { ...prev, currentUsers: data.currentUsers } : null);
          addSystemMessage(`${data.alias} disconnected. [${data.currentUsers}/${data.maxUsers}]`);
          break;
        }

        case 'message': {
          // Decrypt the message using the shared room key
          const key = sharedKeyRef.current;
          if (key) {
            const decrypted = decryptWithSharedKey(
              data.ciphertext,
              data.nonce,
              key
            );

            if (decrypted) {
              const msg: ChatMessage = {
                id: data.messageId || `msg-${Date.now()}`,
                senderAlias: data.senderAlias,
                senderPublicKey: data.senderPublicKey,
                content: decrypted,
                timestamp: data.timestamp,
                isOwn: false,
              };
              setMessages(prev => [...prev, msg]);
            } else {
              console.warn('[UNWITNESSED] Failed to decrypt message — key mismatch');
            }
          } else {
            console.warn('[UNWITNESSED] No shared key available for decryption');
          }
          break;
        }

        case 'room_destroyed': {
          addSystemMessage('Room has been destroyed. All data wiped.');
          setRoomInfo(null);
          setPeers([]);
          break;
        }

        case 'error': {
          setError(data.message);
          break;
        }

        case 'pong':
          break;
      }
    };
  }, [addSystemMessage]);

  const connect = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      setConnectionState('connecting');
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnectionState('connected');
        wsRef.current = ws;
        resolve(ws);
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        wsRef.current = null;
      };

      ws.onerror = () => {
        setConnectionState('error');
        setError('Connection failed. Server may be offline.');
        reject(new Error('WebSocket connection failed'));
      };

      // Use ref indirection so the handler always calls the LATEST version
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessageRef.current(data);
        } catch {
          // ignore malformed messages
        }
      };
    });
  }, []);

  const createRoom = useCallback(async (password: string, roomType: '1v1' | 'group', maxUsers: number) => {
    try {
      const ws = await connect();
      
      // Derive shared key from password (deterministic — no random salt)
      const { key } = deriveKeyFromPassword(password);
      sharedKeyRef.current = key;
      
      const keyPair = keyPairRef.current!;
      
      ws.send(JSON.stringify({
        type: 'create_room',
        roomType,
        maxUsers: roomType === '1v1' ? 2 : maxUsers,
        passwordHash: hashPassword(password),
        publicKey: encodeKey(keyPair.publicKey),
        alias: aliasRef.current,
      }));
    } catch {
      setError('Failed to connect to server.');
    }
  }, [connect]);

  const joinRoom = useCallback(async (roomId: string, password: string) => {
    try {
      const ws = await connect();
      
      // Derive shared key from password (deterministic — same password = same key)
      const { key } = deriveKeyFromPassword(password);
      sharedKeyRef.current = key;
      
      const keyPair = keyPairRef.current!;
      
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId: roomId.toUpperCase().trim(),
        passwordHash: hashPassword(password),
        publicKey: encodeKey(keyPair.publicKey),
        alias: aliasRef.current,
      }));
    } catch {
      setError('Failed to connect to server.');
    }
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || !roomInfo || !sharedKeyRef.current || !keyPairRef.current) return;

    // Encrypt with shared room key
    const { ciphertext, nonce } = encryptWithSharedKey(content, sharedKeyRef.current);
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    wsRef.current.send(JSON.stringify({
      type: 'message',
      roomId: roomInfo.roomId,
      ciphertext,
      nonce,
      senderPublicKey: encodeKey(keyPairRef.current.publicKey),
      senderAlias: aliasRef.current,
      timestamp: Date.now(),
      messageId,
    }));

    // Add to local messages (already decrypted since we sent it)
    const msg: ChatMessage = {
      id: messageId,
      senderAlias: aliasRef.current,
      senderPublicKey: encodeKey(keyPairRef.current.publicKey),
      content,
      timestamp: Date.now(),
      isOwn: true,
    };
    setMessages(prev => [...prev, msg]);
  }, [roomInfo]);

  const leaveRoom = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'leave_room' }));
      wsRef.current.close();
    }
    wsRef.current = null;
    setRoomInfo(null);
    setMessages([]);
    setPeers([]);
    setConnectionState('disconnected');
    sharedKeyRef.current = null;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Ping to keep connection alive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    connectionState,
    roomInfo,
    messages,
    peers,
    myAlias: aliasRef.current,
    myPublicKey: keyPairRef.current ? encodeKey(keyPairRef.current.publicKey) : '',
    createRoom,
    joinRoom,
    sendMessage,
    leaveRoom,
    error,
    clearError,
  };
}
