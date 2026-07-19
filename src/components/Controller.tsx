/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'motion/react';
import {
  Wifi,
  WifiOff,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import { DrivingCommand, ControlMode } from '../types';

const DEFAULT_IP = '192.168.1.10';
const WS_PORT = 81;
const STORAGE_KEY = 'rc_ws_ip';

type ConnState = 'connecting' | 'open' | 'closed';

function normalizeIp(raw: string): string {
  let value = raw.trim();
  value = value.replace(/^wss?:\/\//i, '');
  value = value.split('/')[0] ?? value;
  value = value.replace(/:\d+$/, '');
  return value.trim();
}

function toWsUrl(ip: string): string {
  return `ws://${normalizeIp(ip)}:${WS_PORT}`;
}

function ipv4Prefix(ip: string): string | null {
  const parts = normalizeIp(ip).split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export default function Controller() {
  const [controlMode] = useState<ControlMode>('hold');
  const [currentCommand, setCurrentCommand] = useState<DrivingCommand>('stop');
  const [pressedCommand, setPressedCommand] = useState<DrivingCommand | null>(null);
  const [keyboardActiveKeys, setKeyboardActiveKeys] = useState<Record<string, boolean>>({});
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [ipInput, setIpInput] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_IP;
  });
  const [activeIp, setActiveIp] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_IP;
  });
  const [connectNonce, setConnectNonce] = useState(0);
  const [pageHost, setPageHost] = useState('');

  const wsUrl = toWsUrl(activeIp);
  const pageIsHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  const commandRef = useRef<DrivingCommand>('stop');
  const controlModeRef = useRef<ControlMode>(controlMode);
  const currentCommandRef = useRef<DrivingCommand>('stop');
  const wsRef = useRef<WebSocket | null>(null);
  const sendCommandRef = useRef<(cmd: DrivingCommand) => void>(() => {});
  const activePointersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setPageHost(window.location.host);
  }, []);

  useEffect(() => {
    commandRef.current = currentCommand;
    currentCommandRef.current = currentCommand;
  }, [currentCommand]);

  useEffect(() => {
    controlModeRef.current = controlMode;
  }, [controlMode]);

  // WebSocket: one socket, reconnect every 2s
  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const url = toWsUrl(activeIp);

    const clearTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const hardClose = (ws: WebSocket | null) => {
      if (!ws) return;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
    };

    const scheduleReconnect = () => {
      clearTimer();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!cancelled) openSocket();
      }, 2000);
    };

    const openSocket = () => {
      if (cancelled) return;

      hardClose(socket);
      if (wsRef.current === socket) wsRef.current = null;
      socket = null;

      setConnState('connecting');
      console.log('WebSocket connecting:', url);

      const ws = new WebSocket(url);
      socket = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled || socket !== ws) {
          hardClose(ws);
          return;
        }
        console.log('WebSocket open:', url);
        setConnState('open');
        setStatusMessage(null);
      };

      ws.onerror = () => {
        console.warn('WebSocket error:', url);
      };

      ws.onclose = (ev) => {
        console.log('WebSocket closed:', url, 'code=', ev.code);
        if (socket === ws) socket = null;
        if (wsRef.current === ws) wsRef.current = null;
        setConnState('closed');
        if (!cancelled) scheduleReconnect();
      };
    };

    openSocket();

    return () => {
      cancelled = true;
      clearTimer();
      hardClose(socket);
      socket = null;
      wsRef.current = null;
      setConnState('closed');
    };
  }, [activeIp, connectNonce]);

  const handleConnect = () => {
    const ip = normalizeIp(ipInput);
    if (!ip) {
      setStatusMessage('Enter a valid IP address');
      return;
    }
    setIpInput(ip);
    localStorage.setItem(STORAGE_KEY, ip);
    setActiveIp(ip);
    setConnectNonce((n) => n + 1);
    setStatusMessage(null);
    setConnState('connecting');
    console.log('Manual connect →', toWsUrl(ip));
  };

  const sendCommand = useCallback((cmd: DrivingCommand) => {
    const payload: DrivingCommand = cmd;
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const hint = pageIsHttps
        ? 'Not connected — HTTPS blocks ws://. Open the LAN http:// link on your phone.'
        : 'Not connected — wait for CONNECTED (same Wi‑Fi as NodeMCU).';
      setStatusMessage(hint);
      console.warn(hint, '| readyState=', ws?.readyState, '| skipped:', payload);
      return;
    }

    ws.send(payload);
    console.log('ws.send:', payload);
    setCurrentCommand(payload);
    setStatusMessage(null);
  }, [pageIsHttps]);

  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      let cmd: DrivingCommand | null = null;
      const key = e.key.toLowerCase();

      if (key === 'arrowup' || key === 'w') cmd = 'forward';
      else if (key === 'arrowdown' || key === 's') cmd = 'backward';
      else if (key === 'arrowleft' || key === 'a') cmd = 'left';
      else if (key === 'arrowright' || key === 'd') cmd = 'right';
      else if (key === ' ' || key === 'escape' || key === 'x') {
        e.preventDefault();
        cmd = 'stop';
      }

      if (cmd) {
        e.preventDefault();
        setKeyboardActiveKeys((prev) => ({ ...prev, [key]: true }));
        if (commandRef.current !== cmd) sendCommandRef.current(cmd);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      setKeyboardActiveKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      if (controlModeRef.current === 'hold') {
        const drivingKeys = [
          'arrowup',
          'w',
          'arrowdown',
          's',
          'arrowleft',
          'a',
          'arrowright',
          'd',
        ];
        if (drivingKeys.includes(key)) sendCommandRef.current('stop');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Pointer events work reliably on mobile + desktop (avoids mouse+touch double-fire)
  const onPadPointerDown = (cmd: DrivingCommand, e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    activePointersRef.current.add(e.pointerId);
    setPressedCommand(cmd);
    sendCommand(cmd);
  };

  const onPadPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activePointersRef.current.delete(e.pointerId);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    setPressedCommand(null);
    if (controlMode === 'hold' && currentCommandRef.current !== 'stop') {
      sendCommand('stop');
    }
  };

  const onStopPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setPressedCommand('stop');
    sendCommand('stop');
  };

  const isForwardActive =
    pressedCommand === 'forward' ||
    currentCommand === 'forward' ||
    keyboardActiveKeys['arrowup'] ||
    keyboardActiveKeys['w'];
  const isBackwardActive =
    pressedCommand === 'backward' ||
    currentCommand === 'backward' ||
    keyboardActiveKeys['arrowdown'] ||
    keyboardActiveKeys['s'];
  const isLeftActive =
    pressedCommand === 'left' ||
    currentCommand === 'left' ||
    keyboardActiveKeys['arrowleft'] ||
    keyboardActiveKeys['a'];
  const isRightActive =
    pressedCommand === 'right' ||
    currentCommand === 'right' ||
    keyboardActiveKeys['arrowright'] ||
    keyboardActiveKeys['d'];
  const isStopActive =
    pressedCommand === 'stop' ||
    currentCommand === 'stop' ||
    keyboardActiveKeys[' '] ||
    keyboardActiveKeys['escape'] ||
    keyboardActiveKeys['x'];

  const statusBadge =
    connState === 'open'
      ? {
          className: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30',
          label: `CONNECTED · ${wsUrl}`,
          icon: <Wifi className="w-3.5 h-3.5 shrink-0" />,
        }
      : connState === 'connecting'
        ? {
            className: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
            label: `CONNECTING · ${wsUrl}`,
            icon: <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />,
          }
        : {
            className: 'bg-rose-950/40 text-rose-400 border-rose-500/30',
            label: `OFFLINE · ${wsUrl}`,
            icon: <WifiOff className="w-3.5 h-3.5 shrink-0" />,
          };

  const pageIp = pageHost.split(':')[0] ?? '';
  const pagePrefix = ipv4Prefix(pageIp);
  const carPrefix = ipv4Prefix(activeIp);
  const subnetMismatch =
    !!pagePrefix &&
    !!carPrefix &&
    pagePrefix !== carPrefix &&
    pageIp !== 'localhost' &&
    pageIp !== '127.0.0.1';

  const mobileUrl =
    typeof window !== 'undefined' && pageHost
      ? `${window.location.protocol}//${pageHost}`
      : '';

  const padBtn =
    'w-full aspect-square flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all duration-150 border-2 select-none touch-none [-webkit-user-select:none]';

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 flex flex-col items-center gap-3 font-sans overscroll-none">
      <div
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono ${statusBadge.className}`}
      >
        {statusBadge.icon}
        <span className="truncate">{statusBadge.label}</span>
      </div>

      {pageIsHttps && (
        <div className="w-full text-xs font-mono text-amber-200 bg-amber-950/50 border border-amber-500/40 px-3 py-2 rounded-lg">
          Vercel/HTTPS cannot talk to the car. On your phone open the LAN link shown on the PC
          (http://…:3000), same Wi‑Fi as the NodeMCU.
        </div>
      )}

      {subnetMismatch && (
        <div className="w-full text-xs font-mono text-rose-200 bg-rose-950/50 border border-rose-500/40 px-3 py-2 rounded-lg">
          Network mismatch: this phone/PC is on <code>{pagePrefix}.x</code> but the car IP is{' '}
          <code>{activeIp}</code> ({carPrefix}.x). Put phone + NodeMCU on the <strong>same Wi‑Fi</strong>,
          then enter the IP from Serial Monitor and Connect.
        </div>
      )}

      {mobileUrl && !pageIsHttps && (
        <div className="w-full text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-center break-all">
          Mobile link (same Wi‑Fi):{' '}
          <a className="text-sky-400 underline" href={mobileUrl}>
            {mobileUrl}
          </a>
        </div>
      )}

      <form
        className="w-full flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleConnect();
        }}
      >
        <input
          type="text"
          value={ipInput}
          onChange={(e) => {
            const next = e.target.value;
            setIpInput(next);
            const trimmed = next.trim();
            if (trimmed) {
              localStorage.setItem(STORAGE_KEY, normalizeIp(trimmed) || trimmed);
            }
          }}
          placeholder="192.168.1.10"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          aria-label="NodeMCU IP address"
        />
        <button
          type="submit"
          className="shrink-0 px-4 py-2.5 rounded-lg bg-sky-600 active:bg-sky-500 text-white text-sm font-medium cursor-pointer"
        >
          Connect
        </button>
      </form>

      <p className="text-[11px] text-slate-500 font-mono text-center leading-relaxed">
        1) Same Wi‑Fi as NodeMCU · 2) Enter Serial Monitor IP · 3) Wait for{' '}
        <span className="text-emerald-400">CONNECTED</span> · 4) Drive
      </p>

      {statusMessage && (
        <div className="w-full text-xs font-mono text-rose-400 bg-rose-950/40 border border-rose-500/30 px-3 py-1.5 rounded-lg text-center">
          {statusMessage}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center w-full touch-none">
        <div className="absolute w-[220px] h-[220px] border border-slate-800 rounded-full pointer-events-none opacity-40" />

        <div className="relative z-10 w-full max-w-[320px] aspect-square grid grid-cols-3 grid-rows-3 gap-3 items-center justify-items-center">
          <div />

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onPointerDown={(e) => onPadPointerDown('forward', e)}
            onPointerUp={onPadPointerUp}
            onPointerCancel={onPadPointerUp}
            onPointerLeave={(e) => {
              if (activePointersRef.current.has(e.pointerId)) onPadPointerUp(e);
            }}
            className={`${padBtn} ${
              isForwardActive
                ? 'bg-blue-600 border-blue-400 text-white active-glow-forward'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <ArrowUp className="w-8 h-8 pointer-events-none" />
            <span className="text-[10px] font-mono tracking-widest mt-1 font-bold pointer-events-none">
              FORWARD
            </span>
          </motion.button>

          <div />

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onPointerDown={(e) => onPadPointerDown('left', e)}
            onPointerUp={onPadPointerUp}
            onPointerCancel={onPadPointerUp}
            onPointerLeave={(e) => {
              if (activePointersRef.current.has(e.pointerId)) onPadPointerUp(e);
            }}
            className={`${padBtn} ${
              isLeftActive
                ? 'bg-emerald-600 border-emerald-400 text-white active-glow-left-right'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <ArrowLeft className="w-8 h-8 pointer-events-none" />
            <span className="text-[10px] font-mono tracking-widest mt-1 font-bold pointer-events-none">
              LEFT
            </span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onPointerDown={onStopPointerDown}
            onPointerUp={() => setPressedCommand(null)}
            onPointerCancel={() => setPressedCommand(null)}
            className={`${padBtn} rounded-full ${
              isStopActive
                ? 'bg-rose-600 border-rose-400 text-white active-glow-stop'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <CircleDot className="w-10 h-10 pointer-events-none" />
            <span className="text-[10px] font-mono tracking-widest mt-1 font-bold pointer-events-none">
              STOP
            </span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onPointerDown={(e) => onPadPointerDown('right', e)}
            onPointerUp={onPadPointerUp}
            onPointerCancel={onPadPointerUp}
            onPointerLeave={(e) => {
              if (activePointersRef.current.has(e.pointerId)) onPadPointerUp(e);
            }}
            className={`${padBtn} ${
              isRightActive
                ? 'bg-emerald-600 border-emerald-400 text-white active-glow-left-right'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <ArrowRight className="w-8 h-8 pointer-events-none" />
            <span className="text-[10px] font-mono tracking-widest mt-1 font-bold pointer-events-none">
              RIGHT
            </span>
          </motion.button>

          <div />

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onPointerDown={(e) => onPadPointerDown('backward', e)}
            onPointerUp={onPadPointerUp}
            onPointerCancel={onPadPointerUp}
            onPointerLeave={(e) => {
              if (activePointersRef.current.has(e.pointerId)) onPadPointerUp(e);
            }}
            className={`${padBtn} ${
              isBackwardActive
                ? 'bg-amber-600 border-amber-400 text-white active-glow-backward'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <ArrowDown className="w-8 h-8 pointer-events-none" />
            <span className="text-[10px] font-mono tracking-widest mt-1 font-bold pointer-events-none">
              REVERSE
            </span>
          </motion.button>

          <div />
        </div>
      </div>
    </div>
  );
}
