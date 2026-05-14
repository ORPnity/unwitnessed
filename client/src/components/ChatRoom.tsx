/**
 * UNWITNESSED — Chat Room Component
 * The main encrypted chat interface
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { UseSocketReturn } from '@/lib/useSocket';
import { encryptExport, decryptExport, generateEncryptedPreview } from '@/lib/crypto';
import { ChatMessage, ExportedChat } from '@/lib/types';

interface ChatRoomProps {
  socket: UseSocketReturn;
  onLeave: () => void;
}

export function ChatRoom({ socket, onLeave }: ChatRoomProps) {
  const [input, setInput] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, roomInfo, peers, myAlias, sendMessage } = socket;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Export chat
  const handleExport = useCallback(() => {
    if (!exportPassword) {
      showToast('Password required for export');
      return;
    }

    const chatData: ExportedChat = {
      messages: messages.filter(m => !m.isSystem),
      roomType: roomInfo?.roomType || '1v1',
      exportedAt: Date.now(),
      participantCount: (peers?.length || 0) + 1,
    };

    const encrypted = encryptExport(chatData, exportPassword);
    const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unwitnessed-${Date.now()}.enc`;
    a.click();
    URL.revokeObjectURL(url);

    setShowExport(false);
    setExportPassword('');
    showToast('Chat exported (encrypted)');
  }, [exportPassword, messages, roomInfo, peers]);

  // Import chat
  const handleImport = useCallback(() => {
    if (!importFile || !importPassword) {
      showToast('Select file and enter password');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const decrypted = decryptExport(data, importPassword) as ExportedChat | null;

        if (!decrypted) {
          showToast('Decryption failed. Wrong password?');
          return;
        }

        // Show imported messages as system info
        decrypted.messages.forEach((msg: ChatMessage) => {
          sendMessage(`[IMPORTED] ${msg.senderAlias}: ${msg.content}`);
        });

        setShowImport(false);
        setImportPassword('');
        setImportFile(null);
        showToast(`Imported ${decrypted.messages.length} messages`);
      } catch {
        showToast('Invalid export file');
      }
    };
    reader.readAsText(importFile);
  }, [importFile, importPassword, sendMessage]);

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Header */}
      <header className="border-b border-white/10 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onLeave}
            className="text-white/30 hover:text-red-400 text-[10px] sm:text-xs tracking-wider sm:tracking-[0.2em] uppercase transition-colors"
            id="leave-room-btn"
          >
            [ EXIT ]
          </button>
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          <div className="hidden sm:block text-xs tracking-[0.2em] text-white/40 uppercase">
            {roomInfo?.roomId}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-2 text-[10px] tracking-wider text-white/25 uppercase">
            <span className="status-dot active" />
            <span>{(peers?.length || 0) + 1}/{roomInfo?.maxUsers}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-white/30 hover:text-white text-[10px] sm:text-xs tracking-wider sm:tracking-[0.2em] uppercase transition-colors"
            id="room-info-btn"
          >
            <span className="hidden sm:inline">[ INFO ]</span>
            <span className="sm:hidden">[ i ]</span>
          </button>
          <button
            onClick={() => setShowExport(!showExport)}
            className="text-white/30 hover:text-white text-[10px] sm:text-xs tracking-wider sm:tracking-[0.2em] uppercase transition-colors"
            id="export-btn"
          >
            [ ↓ ]
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-white/30 hover:text-white text-[10px] sm:text-xs tracking-wider sm:tracking-[0.2em] uppercase transition-colors"
            id="import-btn"
          >
            [ ↑ ]
          </button>
        </div>
      </header>

      {/* Room Info Panel */}
      {showInfo && (
        <div className="border-b border-white/10 px-4 py-4 bg-white/[0.02] fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] uppercase tracking-wider">
            <div className="col-span-2 md:col-span-1">
              <span className="text-white/25 block">ROOM ID</span>
              <span className="text-white/60 mt-1 block font-mono">{roomInfo?.roomId}</span>
            </div>
            <div>
              <span className="text-white/25 block">TYPE</span>
              <span className="text-white/60 mt-1 block">{roomInfo?.roomType?.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-white/25 block">USERS</span>
              <span className="text-white/60 mt-1 block">{(peers?.length || 0) + 1} / {roomInfo?.maxUsers}</span>
            </div>
            <div>
              <span className="text-white/25 block">YOUR ALIAS</span>
              <span className="text-white/60 mt-1 block">{myAlias}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-white/15 text-[9px] tracking-wider uppercase">
              E2E ENCRYPTED • XCHACHA20-POLY1305 • ZERO KNOWLEDGE SERVER • SELF-DESTRUCT ON EXIT
            </p>
          </div>
        </div>
      )}

      {/* Export Panel */}
      {showExport && (
        <div className="border-b border-white/10 px-4 py-4 bg-white/[0.02] fade-in">
          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">EXPORT ENCRYPTED CHAT</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              placeholder="Encryption password..."
              className="input-field flex-1 py-2 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleExport()}
            />
            <button onClick={handleExport} className="btn-secondary py-2 px-4 text-[10px]">
              EXPORT
            </button>
            <button onClick={() => setShowExport(false)} className="text-white/20 hover:text-white px-2 text-xs">
              ✕
            </button>
          </div>
          <p className="text-white/10 text-[9px] tracking-wider mt-2 uppercase">
            File stays on your device only. Never uploaded.
          </p>
        </div>
      )}

      {/* Import Panel */}
      {showImport && (
        <div className="border-b border-white/10 px-4 py-4 bg-white/[0.02] fade-in">
          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">IMPORT ENCRYPTED CHAT</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary py-2 px-4 text-[10px]"
            >
              {importFile ? importFile.name : 'SELECT .ENC FILE'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".enc,.json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <input
              type="password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              placeholder="Decryption password..."
              className="input-field flex-1 py-2 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
            <button onClick={handleImport} className="btn-secondary py-2 px-4 text-[10px]">
              IMPORT
            </button>
            <button onClick={() => setShowImport(false)} className="text-white/20 hover:text-white px-2 text-xs">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll px-4 py-4" id="messages-container">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <p className="text-white/15 text-xs tracking-[0.3em] uppercase">
                ENCRYPTED CHANNEL ACTIVE
              </p>
              <p className="text-white/8 text-[10px] tracking-wider uppercase cursor-blink">
                Waiting for messages
              </p>
              <div className="encrypted-decoration text-[9px] max-w-xs mx-auto mt-4">
                {generateEncryptedPreview(50)}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 px-4 py-3 flex-shrink-0">
        <div className="flex gap-3 items-center">
          <span className="text-white/20 text-xs tracking-wider select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type message..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm font-mono placeholder:text-white/15"
            id="message-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="text-white/30 hover:text-white text-xs tracking-[0.2em] uppercase transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            id="send-btn"
          >
            [ SEND ]
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-white/8 text-[9px] tracking-wider uppercase">
            <span className="hidden sm:inline">ENCRYPTED WITH XCHACHA20-POLY1305</span>
            <span className="sm:hidden">E2E ENCRYPTED</span>
          </p>
          <p className="text-white/8 text-[9px] tracking-wider uppercase">
            {myAlias}
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast">{toast}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Message Bubble
// ═══════════════════════════════════════════

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.isSystem) {
    return (
      <div className="py-1 fade-in">
        <div className="text-[10px] tracking-wider text-white/20 uppercase font-mono">
          <span className="text-white/10 mr-2">{formatTime(message.timestamp)}</span>
          <span className="text-white/10 mr-1">[SYS]</span>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`py-1.5 fade-in ${message.isOwn ? '' : ''}`}>
      <div className={`pl-3 ${message.isOwn ? 'msg-own' : 'msg-other'} py-2 pr-3`}>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-[10px] tracking-wider uppercase font-bold ${
            message.isOwn ? 'text-white/50' : 'text-white/35'
          }`}>
            {message.isOwn ? 'YOU' : message.senderAlias}
          </span>
          <span className="text-[9px] text-white/10 font-mono">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <p className="text-sm text-white/80 break-words font-mono leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
