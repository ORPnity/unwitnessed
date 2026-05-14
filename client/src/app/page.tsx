/**
 * UNWITNESSED — Homepage
 * Minimal, brutalist entry point with Create Room / Join Room
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreateRoom } from '@/components/CreateRoom';
import { JoinRoom } from '@/components/JoinRoom';
import { ChatRoom } from '@/components/ChatRoom';
import { useSocket } from '@/lib/useSocket';
import { generateEncryptedPreview } from '@/lib/crypto';

type View = 'home' | 'create' | 'join' | 'chat';

export default function Home() {
  const [view, setView] = useState<View>('home');
  const [encryptedBg, setEncryptedBg] = useState<string[]>([]);
  const [decorLine, setDecorLine] = useState('');
  const [glitchActive, setGlitchActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const socket = useSocket();

  // Mark as mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate encrypted background text (client-side only)
  useEffect(() => {
    if (!mounted) return;

    const lines: string[] = [];
    for (let i = 0; i < 30; i++) {
      lines.push(generateEncryptedPreview(120));
    }
    setEncryptedBg(lines);
    setDecorLine(generateEncryptedPreview(60));

    // Regenerate periodically for subtle animation
    const interval = setInterval(() => {
      setEncryptedBg(prev => {
        const newLines = [...prev];
        const idx = Math.floor(Math.random() * newLines.length);
        newLines[idx] = generateEncryptedPreview(120);
        return newLines;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [mounted]);

  // Random glitch effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.92) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 150);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Navigate to chat when room is created or joined
  useEffect(() => {
    if (socket.roomInfo) {
      setView('chat');
    }
  }, [socket.roomInfo]);

  // Navigate home when room is left
  useEffect(() => {
    if (!socket.roomInfo && view === 'chat') {
      setView('home');
    }
  }, [socket.roomInfo, view]);

  const handleBack = useCallback(() => {
    setView('home');
  }, []);

  if (view === 'chat' && socket.roomInfo) {
    return <ChatRoom socket={socket} onLeave={() => { socket.leaveRoom(); setView('home'); }} />;
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      {/* Encrypted background */}
      {mounted && encryptedBg.length > 0 && (
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none select-none overflow-hidden" aria-hidden="true">
          {encryptedBg.map((line, i) => (
            <div key={i} className="text-[10px] leading-[14px] whitespace-nowrap text-white/50 font-mono">
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        {view === 'home' && (
          <div className={`flex flex-col items-center gap-12 fade-in ${glitchActive ? 'glitch-text' : ''}`}>
            {/* Logo / Title */}
            <div className="text-center space-y-6">
              <div className="relative">
                <h1 
                  className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-[0.15em] sm:tracking-[0.3em] uppercase select-none"
                  style={{ fontFamily: "'Special Elite', 'Courier New', monospace" }}
                >
                  UNWITNESSED
                </h1>
                <div className="absolute inset-0 text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-[0.15em] sm:tracking-[0.3em] uppercase select-none opacity-0 hover:opacity-100 transition-opacity"
                  style={{ 
                    fontFamily: "'Special Elite', 'Courier New', monospace",
                    textShadow: '2px 0 #ff0000, -2px 0 #00ffff',
                    clipPath: 'inset(0 0 50% 0)',
                  }}
                >
                  UNWITNESSED
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs md:text-sm tracking-[0.5em] uppercase text-white/30">
                  Nothing witnessed.
                </p>
                <p className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-white/15">
                  No identity. No history. No trace.
                </p>
              </div>

              {/* Decorative encrypted line */}
              {mounted && decorLine && (
                <div className="encrypted-decoration max-w-md mx-auto">
                  {decorLine}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button
                onClick={() => setView('create')}
                className="btn-primary flex-1 py-4"
                id="create-room-btn"
              >
                <span className="block text-xs tracking-[0.3em]">[ CREATE ROOM ]</span>
              </button>
              <button
                onClick={() => setView('join')}
                className="btn-secondary flex-1 py-4"
                id="join-room-btn"
              >
                <span className="block text-xs tracking-[0.3em]">[ JOIN ROOM ]</span>
              </button>
            </div>

            {/* Bottom info */}
            <div className="text-center space-y-3 mt-8">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-white/15 text-[8px] sm:text-[10px] tracking-[0.15em] sm:tracking-[0.3em] uppercase px-2">
                <span>E2E ENCRYPTED</span>
                <span className="text-white/10 hidden sm:inline">|</span>
                <span>ZERO KNOWLEDGE</span>
                <span className="text-white/10 hidden sm:inline">|</span>
                <span>SELF-DESTRUCT</span>
              </div>
              <p className="text-white/8 text-[9px] tracking-widest uppercase">
                Conversations exist only in the moment
              </p>
            </div>
          </div>
        )}

        {view === 'create' && (
          <CreateRoom 
            onBack={handleBack}
            onCreateRoom={(password, roomType, maxUsers) => {
              socket.createRoom(password, roomType, maxUsers);
            }}
            error={socket.error}
            clearError={socket.clearError}
            connectionState={socket.connectionState}
          />
        )}

        {view === 'join' && (
          <JoinRoom 
            onBack={handleBack}
            onJoinRoom={(roomId, password) => {
              socket.joinRoom(roomId, password);
            }}
            error={socket.error}
            clearError={socket.clearError}
            connectionState={socket.connectionState}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center">
        <p className="text-white/8 text-[9px] tracking-[0.3em] uppercase">
          UNWITNESSED v0.1.0 — ZERO TRACE PROTOCOL
        </p>
      </footer>
    </main>
  );
}
