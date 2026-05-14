/**
 * UNWITNESSED — Create Room Component
 */

'use client';

import { useState } from 'react';
import { RoomType } from '@/lib/types';
import { ConnectionState } from '@/lib/useSocket';

interface CreateRoomProps {
  onBack: () => void;
  onCreateRoom: (password: string, roomType: RoomType, maxUsers: number) => void;
  error: string | null;
  clearError: () => void;
  connectionState: ConnectionState;
}

export function CreateRoom({ onBack, onCreateRoom, error, clearError, connectionState }: CreateRoomProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('1v1');
  const [maxUsers, setMaxUsers] = useState(5);
  const [localError, setLocalError] = useState('');

  const handleCreate = () => {
    clearError();
    setLocalError('');

    if (!password) {
      setLocalError('Password is required.');
      return;
    }
    if (password.length < 4) {
      setLocalError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    onCreateRoom(password, roomType, maxUsers);
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
        <h2 className="text-2xl md:text-3xl font-bold tracking-[0.2em] uppercase mb-2">
          CREATE ROOM
        </h2>
        <p className="text-xs text-white/30 tracking-[0.2em] uppercase">
          Initialize a new encrypted channel
        </p>
        <div className="mt-3 h-px bg-white/10" />
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Room Type */}
        <div>
          <label className="panel-header block mb-3">ROOM TYPE</label>
          <div className="flex gap-3">
            <button
              onClick={() => setRoomType('1v1')}
              className={`flex-1 py-3 px-4 border text-xs tracking-[0.2em] uppercase transition-all ${
                roomType === '1v1'
                  ? 'border-white bg-white text-black'
                  : 'border-white/20 bg-transparent text-white/50 hover:border-white/40'
              }`}
            >
              1 v 1
            </button>
            <button
              onClick={() => setRoomType('group')}
              className={`flex-1 py-3 px-4 border text-xs tracking-[0.2em] uppercase transition-all ${
                roomType === 'group'
                  ? 'border-white bg-white text-black'
                  : 'border-white/20 bg-transparent text-white/50 hover:border-white/40'
              }`}
            >
              GROUP
            </button>
          </div>
        </div>

        {/* Max Users (Group only) */}
        {roomType === 'group' && (
          <div className="slide-up">
            <label className="panel-header block mb-3">MAX USERS</label>
            <div className="grid grid-cols-4 gap-2">
              {[2, 5, 10, 20].map(num => (
                <button
                  key={num}
                  onClick={() => setMaxUsers(num)}
                  className={`py-3 border text-xs tracking-wider transition-all ${
                    maxUsers === num
                      ? 'border-white bg-white text-black font-bold'
                      : 'border-white/20 bg-transparent text-white/50 hover:border-white/40'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Password */}
        <div>
          <label className="panel-header block mb-3">ROOM PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter room password..."
            className="input-field mb-3"
            id="create-password-input"
            autoComplete="off"
            spellCheck={false}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password..."
            className="input-field"
            id="create-confirm-password-input"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
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
          <p>• Share Room ID + Password via secure channel only</p>
          <p>• Password is hashed before transmission</p>
          <p>• Server never stores plaintext passwords</p>
          <p>• Room self-destructs when all users leave</p>
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={isLoading}
          className="btn-primary w-full py-4 disabled:opacity-30 disabled:cursor-not-allowed"
          id="create-room-submit"
        >
          {isLoading ? (
            <span className="loading-dots">INITIALIZING</span>
          ) : (
            '[ INITIALIZE ROOM ]'
          )}
        </button>
      </div>
    </div>
  );
}
