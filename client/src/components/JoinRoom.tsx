/**
 * UNWITNESSED — Join Room Component
 */

'use client';

import { useState } from 'react';
import { ConnectionState } from '@/lib/useSocket';

interface JoinRoomProps {
  onBack: () => void;
  onJoinRoom: (roomId: string, password: string) => void;
  error: string | null;
  clearError: () => void;
  connectionState: ConnectionState;
}

export function JoinRoom({ onBack, onJoinRoom, error, clearError, connectionState }: JoinRoomProps) {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const formatRoomId = (value: string) => {
    // Auto-format as XXXX-XXXX-XXXX-XXXX
    const clean = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 16);
    const parts = [];
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.slice(i, i + 4));
    }
    return parts.join('-');
  };

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomId(formatRoomId(e.target.value));
  };

  const handleJoin = () => {
    clearError();
    setLocalError('');

    if (!roomId || roomId.replace(/-/g, '').length < 16) {
      setLocalError('Enter a valid Room ID.');
      return;
    }
    if (!password) {
      setLocalError('Password is required.');
      return;
    }

    onJoinRoom(roomId, password);
  };

  const isLoading = connectionState === 'connecting';
  const displayError = localError || error;

  return (
    <div className="w-full max-w-lg fade-in">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={onBack} 
          className="text-white/30 hover:text-white text-xs tracking-[0.3em] uppercase transition-colors mb-6 block"
        >
          ← BACK
        </button>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase mb-2 text-center sm:text-left">
          JOIN ROOM
        </h2>
        <p className="text-[10px] sm:text-xs text-white/30 tracking-[0.1em] sm:tracking-[0.2em] uppercase text-center sm:text-left">
          Connect to an encrypted channel
        </p>
        <div className="mt-3 h-px bg-white/10" />
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Room ID */}
        <div>
          <label className="panel-header block mb-3">ROOM ID</label>
          <input
            type="text"
            value={roomId}
            onChange={handleRoomIdChange}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="input-field text-center tracking-[0.1em] sm:tracking-[0.3em] text-sm sm:text-lg"
            id="join-room-id-input"
            autoComplete="off"
            spellCheck={false}
            maxLength={19}
          />
          <p className="mt-2 text-white/15 text-[10px] tracking-wider uppercase">
            Enter the Room ID provided by the host
          </p>
        </div>

        {/* Password */}
        <div>
          <label className="panel-header block mb-3">ROOM PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter room password..."
            className="input-field"
            id="join-password-input"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
        </div>

        {/* Error */}
        {displayError && (
          <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-red-400 text-xs tracking-wider uppercase fade-in">
            ⚠ {displayError}
          </div>
        )}

        {/* Security notice */}
        <div className="border border-white/5 bg-white/[0.02] px-4 py-3 text-white/20 text-[10px] tracking-wider uppercase space-y-1">
          <p>• No invite links — Room ID + Password only</p>
          <p>• Connection is end-to-end encrypted</p>
          <p>• No browser history traces</p>
        </div>

        {/* Join button */}
        <button
          onClick={handleJoin}
          disabled={isLoading}
          className="btn-primary w-full py-4 disabled:opacity-30 disabled:cursor-not-allowed"
          id="join-room-submit"
        >
          {isLoading ? (
            <span className="loading-dots">CONNECTING</span>
          ) : (
            '[ CONNECT ]'
          )}
        </button>
      </div>
    </div>
  );
}
