/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  WifiOff, 
  Settings, 
  RefreshCw, 
  X, 
  History, 
  Smartphone, 
  Activity, 
  Zap, 
  Sliders, 
  Volume2, 
  VolumeX, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  CircleDot,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { DrivingCommand, ControlMode, CommandLog } from '../types';

interface ControllerProps {
  initialDbUrl?: string;
}

export default function Controller({ initialDbUrl = 'https://rc-car-549aa-default-rtdb.firebaseio.com/command.json' }: ControllerProps) {
  // Config States
  const [dbUrl, setDbUrl] = useState<string>(() => {
    return localStorage.getItem('rc_firebase_url') || initialDbUrl;
  });
  const [editingUrl, setEditingUrl] = useState<string>(dbUrl);
  const [controlMode, setControlMode] = useState<ControlMode>(() => {
    return (localStorage.getItem('rc_control_mode') as ControlMode) || 'hold';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('rc_sound_enabled') !== 'false';
  });

  // UI Panel States
  const [showSettings, setShowSettings] = useState(false);
  const [lastPing, setLastPing] = useState<number | null>(null);
  const [isUrlValid, setIsUrlValid] = useState<boolean | null>(null);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);

  // Controller Driving States
  const [currentCommand, setCurrentCommand] = useState<DrivingCommand>('stop');
  const [isSending, setIsSending] = useState(false);
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [keyboardActiveKeys, setKeyboardActiveKeys] = useState<Record<string, boolean>>({});

  // Refs to keep track of current states within event listeners
  const commandRef = useRef<DrivingCommand>('stop');
  const controlModeRef = useRef<ControlMode>(controlMode);
  const dbUrlRef = useRef<string>(dbUrl);

  useEffect(() => {
    commandRef.current = currentCommand;
  }, [currentCommand]);

  useEffect(() => {
    controlModeRef.current = controlMode;
  }, [controlMode]);

  useEffect(() => {
    dbUrlRef.current = dbUrl;
  }, [dbUrl]);

  // Save Config Preferences
  useEffect(() => {
    localStorage.setItem('rc_firebase_url', dbUrl);
  }, [dbUrl]);

  useEffect(() => {
    localStorage.setItem('rc_control_mode', controlMode);
  }, [controlMode]);

  useEffect(() => {
    localStorage.setItem('rc_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  // Synthesis tactile sound effects (Web Audio API)
  const beep = (freq: number, type: OscillatorType = 'sine', duration = 0.08) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Ignored if user has not interacted yet
    }
  };

  // Play distinctive tones based on command
  const playCommandSound = (cmd: DrivingCommand) => {
    switch (cmd) {
      case 'forward':
        beep(540, 'sine', 0.1);
        break;
      case 'backward':
        beep(360, 'sine', 0.1);
        break;
      case 'left':
        beep(460, 'sine', 0.08);
        break;
      case 'right':
        beep(480, 'sine', 0.08);
        break;
      case 'stop':
        beep(280, 'triangle', 0.12);
        break;
    }
  };

  // Send Command to Firebase Realtime Database
  const sendCommand = async (cmd: DrivingCommand) => {
    const startTime = performance.now();
    setIsSending(true);
    
    const newLog: CommandLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      command: cmd,
      success: false,
      latency: 0,
    };

    try {
      playCommandSound(cmd);

      const response = await fetch(dbUrlRef.current, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cmd),
      });

      const endTime = performance.now();
      const latencyInMs = Math.round(endTime - startTime);
      setLastPing(latencyInMs);

      if (response.ok) {
        newLog.success = true;
        newLog.latency = latencyInMs;
        setLogs(prev => [newLog, ...prev.slice(0, 49)]);
        setCurrentCommand(cmd);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      const endTime = performance.now();
      newLog.latency = Math.round(endTime - startTime);
      newLog.error = error?.message || 'Network disconnected';
      setLogs(prev => [newLog, ...prev.slice(0, 49)]);
      
      // Fallback update current command visual even on local failure to avoid interface lock, 
      // but flash warning
      setCurrentCommand(cmd);
      beep(150, 'sawtooth', 0.15);
    } finally {
      setIsSending(false);
    }
  };

  // Ping / Validate Firebase Realtime Database Connection
  const validateConnection = async (testUrl: string) => {
    setIsValidatingUrl(true);
    setIsUrlValid(null);
    const startTime = performance.now();

    try {
      // Send GET status of endpoint
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      const endTime = performance.now();
      if (response.ok) {
        setIsUrlValid(true);
        setLastPing(Math.round(endTime - startTime));
        beep(600, 'sine', 0.12);
      } else {
        setIsUrlValid(false);
        beep(180, 'sine', 0.12);
      }
    } catch (e) {
      setIsUrlValid(false);
      beep(180, 'sine', 0.12);
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // Keyboard Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Stop handling if user is inside form inputs
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      let cmd: DrivingCommand | null = null;
      const key = e.key.toLowerCase();

      if (key === 'arrowup' || key === 'w') {
        cmd = 'forward';
      } else if (key === 'arrowdown' || key === 's') {
        cmd = 'backward';
      } else if (key === 'arrowleft' || key === 'a') {
        cmd = 'left';
      } else if (key === 'arrowright' || key === 'd') {
        cmd = 'right';
      } else if (key === ' ' || key === 'escape' || key === 'x') {
        e.preventDefault(); // Stop space-bar scrolling page
        cmd = 'stop';
      }

      if (cmd) {
        e.preventDefault();
        setKeyboardActiveKeys(prev => ({ ...prev, [key]: true }));

        // Only send command if it actually changed and we are in single-fire mode or hold-mode
        if (commandRef.current !== cmd) {
          sendCommand(cmd);
        }
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
      
      // Clear key state
      setKeyboardActiveKeys(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      // In Hold Mode, letting go of any active driving key sends STOP command
      if (controlModeRef.current === 'hold') {
        const drivingKeys = ['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd'];
        if (drivingKeys.includes(key)) {
          // If no other driving keys are active, safe-release to stop
          sendCommand('stop');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Set default initial path verification
  useEffect(() => {
    validateConnection(dbUrl);
  }, []);

  // Button Action Triggers (Press & Hold or Toggle Mode Helper)
  const handleButtonPress = (cmd: DrivingCommand) => {
    if (controlMode === 'hold') {
      sendCommand(cmd);
    } else {
      // Toggle mode behavior
      if (currentCommand === cmd) {
        sendCommand('stop');
      } else {
        sendCommand(cmd);
      }
    }
  };

  const handleButtonRelease = () => {
    if (controlMode === 'hold' && currentCommand !== 'stop') {
      sendCommand('stop');
    }
  };

  const handleSaveSettings = () => {
    setDbUrl(editingUrl);
    setShowSettings(false);
    validateConnection(editingUrl);
  };

  const clearLogs = () => {
    setLogs([]);
    beep(300, 'triangle', 0.05);
  };

  // Estimated values based on commands for realistic visual telemetry!
  const getSpeedPercentage = () => {
    if (currentCommand === 'stop') return 0;
    if (currentCommand === 'forward' || currentCommand === 'backward') return 100;
    return 60; // Turns use a bit less speed power
  };

  const getVoltage = () => {
    if (currentCommand === 'stop') return 12.0; // Rest voltage
    if (currentCommand === 'forward' || currentCommand === 'backward') return 11.2; // Motor sag
    return 11.6; // Turn steering sag
  };

  // Determine button active visual highlights
  const isForwardActive = currentCommand === 'forward' || keyboardActiveKeys['arrowup'] || keyboardActiveKeys['w'];
  const isBackwardActive = currentCommand === 'backward' || keyboardActiveKeys['arrowdown'] || keyboardActiveKeys['s'];
  const isLeftActive = currentCommand === 'left' || keyboardActiveKeys['arrowleft'] || keyboardActiveKeys['a'];
  const isRightActive = currentCommand === 'right' || keyboardActiveKeys['arrowright'] || keyboardActiveKeys['d'];
  const isStopActive = currentCommand === 'stop' || keyboardActiveKeys[' '] || keyboardActiveKeys['escape'] || keyboardActiveKeys['x'];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
      
      {/* Top Banner Status Bar */}
      <div className="lg:col-span-12 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 p-2.5 rounded-lg border border-blue-500/20">
            <Smartphone className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">ESP32 Rover Remote</h1>
            <p className="text-xs text-slate-400 font-mono truncate max-w-[280px] md:max-w-[400px]">
              {dbUrl}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Signal status check */}
          <button 
            onClick={() => validateConnection(dbUrl)}
            disabled={isValidatingUrl}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              isUrlValid === true 
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/40'
                : isUrlValid === false
                ? 'bg-rose-950/40 text-rose-400 border-rose-500/30 hover:bg-rose-900/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Ping Firebase RTD URL"
          >
            {isValidatingUrl ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isUrlValid === true ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span>
              {isValidatingUrl ? 'PINGING...' : isUrlValid === true ? `${lastPing || 0}ms` : 'OFFLINE'}
            </span>
          </button>

          {/* Sound Toggle Button */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            title={soundEnabled ? "Mute audio beeps" : "Unmute audio beeps"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Mode Badge indicator */}
          <span className="bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-medium px-2.5 py-1.5 rounded-lg uppercase">
            {controlMode === 'hold' ? '⚡ Hold-to-Run' : '🔒 Tap-to-Lock'}
          </span>

          {/* Config Settings Trigger */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingUrl(dbUrl);
              setShowSettings(!showSettings);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium cursor-pointer shadow-md transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Setup</span>
          </motion.button>
        </div>
      </div>

      {/* Main Grid: Joystick / Remote on Left, Logs/Telemetry on Right */}
      <main className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Connection Configuration Window */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col gap-4 text-slate-200"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-md font-semibold text-white">Database & Hardware Setup</h3>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Firebase URL */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Firebase Realtime DB URL
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="url"
                      value={editingUrl}
                      onChange={(e) => setEditingUrl(e.target.value)}
                      placeholder="https://your-project.firebaseio.com/command.json"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => validateConnection(editingUrl)}
                      className="px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 rounded-lg text-xs cursor-pointer transition-colors font-mono"
                    >
                      {isValidatingUrl ? 'PINGING...' : 'TEST'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                    Needs to point to a public JSON database path (must end with <code className="text-slate-300">.json</code>).
                  </p>
                </div>

                {/* Control Action mode */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Control Response Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setControlMode('hold')}
                      className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        controlMode === 'hold' 
                          ? 'border-indigo-500 bg-indigo-550/10 text-white' 
                          : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400'
                      }`}
                    >
                      <span className="text-sm font-semibold flex items-center gap-1">
                        ⚡ Hold-to-Run
                      </span>
                      <span className="text-xs text-slate-500 leading-tight">
                        Moves on press/hold, inputs "stop" automatically on key/touch release. Ideal for precise rover safety.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setControlMode('toggle')}
                      className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        controlMode === 'toggle' 
                          ? 'border-indigo-500 bg-indigo-550/10 text-white' 
                          : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400'
                      }`}
                    >
                      <span className="text-sm font-semibold flex items-center gap-1">
                        🔒 Tap-to-Lock
                      </span>
                      <span className="text-xs text-slate-500 leading-tight">
                        Single click triggers continuous motion until another instruction or central STOP is triggered.
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* URL Status indicators */}
              {isUrlValid === true && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Connection validated successfully. Database reached!</span>
                </div>
              )}
              {isUrlValid === false && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-950/40 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Warning: Failed to reach database. Verify URL, SSL, or public access rules.</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md hover:shadow-emerald-500/10 cursor-pointer transition-all"
                >
                  Save URL
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Telemetry Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1 items-center justify-center">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-semibold">Active Motion</span>
            <span className={`text-md font-mono font-bold tracking-widest uppercase transition-colors duration-150 ${
              currentCommand === 'stop' ? 'text-rose-500' : 'text-emerald-400 animate-pulse'
            }`}>
              {currentCommand}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1 items-center justify-center">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-semibold">Throttle Output</span>
            <span className="text-md font-mono font-bold text-blue-400">
              {getSpeedPercentage()}%
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1 items-center justify-center">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-semibold">VCC Voltage</span>
            <span className="text-md font-mono font-bold text-yellow-500">
              {getVoltage().toFixed(1)} V
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1 items-center justify-center">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-semibold">Ping Latency</span>
            <span className="text-md font-mono font-bold text-cyan-400">
              {lastPing ? `${lastPing}ms` : '--'}
            </span>
          </div>
        </div>

        {/* Tactile D-PAD Remote controller block */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[380px] md:min-h-[440px]">
          {/* Circular abstract tech visual bg decoration */}
          <div className="absolute w-[240px] h-[240px] md:w-[320px] md:h-[320px] border border-slate-800 rounded-full flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-[160px] h-[160px] md:w-[220px] md:h-[220px] border border-slate-800 rounded-full flex items-center justify-center">
              <div className="w-[80px] h-[80px] md:w-[120px] md:h-[120px] border border-slate-800 rounded-full border-dashed" />
            </div>
          </div>

          {/* Core Controller interface buttons */}
          <div className="relative z-10 w-full max-w-[320px] h-[320px] md:max-w-[380px] md:h-[380px] grid grid-cols-3 grid-rows-3 gap-3 md:gap-4 items-center justify-items-center">
            
            {/* Row 1 / Col 1: Empty */}
            <div />

            {/* Row 1 / Col 2: FORWARD */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseDown={() => handleButtonPress('forward')}
              onMouseUp={handleButtonRelease}
              onMouseLeave={handleButtonRelease}
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('forward'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonRelease(); }}
              className={`w-full aspect-square flex flex-col items-center justify-center rounded-2xl md:rounded-3xl cursor-pointer transition-all duration-150 border-2 select-none ${
                isForwardActive 
                  ? 'bg-blue-600 border-blue-400 text-white active-glow-forward scale-[0.98]' 
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-950/10'
              }`}
            >
              <ArrowUp className={`w-8 h-8 md:w-10 md:h-10 transition-transform ${isForwardActive ? 'translate-y-[-2px] animate-bounce' : ''}`} />
              <span className="text-[10px] font-mono tracking-widest mt-1 font-bold">FORWARD</span>
              <kbd className="hidden md:inline-block font-mono text-[9px] mt-1 bg-slate-800/80 px-1 py-0.5 rounded text-slate-400">[W]</kbd>
            </motion.button>

            {/* Row 1 / Col 3: Empty */}
            <div />

            {/* Row 2 / Col 1: LEFT */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseDown={() => handleButtonPress('left')}
              onMouseUp={handleButtonRelease}
              onMouseLeave={handleButtonRelease}
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('left'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonRelease(); }}
              className={`w-full aspect-square flex flex-col items-center justify-center rounded-2xl md:rounded-3xl cursor-pointer transition-all duration-150 border-2 select-none ${
                isLeftActive 
                  ? 'bg-emerald-600 border-emerald-400 text-white active-glow-left-right scale-[0.98]' 
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/10'
              }`}
            >
              <ArrowLeft className={`w-8 h-8 md:w-10 md:h-10 transition-transform ${isLeftActive ? 'translate-x-[-2px]' : ''}`} />
              <span className="text-[10px] font-mono tracking-widest mt-1 font-bold">LEFT</span>
              <kbd className="hidden md:inline-block font-mono text-[9px] mt-1 bg-slate-800/80 px-1 py-0.5 rounded text-slate-400">[A]</kbd>
            </motion.button>

            {/* Row 2 / Col 2: STOP CENTER RED */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => sendCommand('stop')}
              className={`w-full aspect-square flex flex-col items-center justify-center rounded-full cursor-pointer transition-all duration-150 border-2 select-none ${
                isStopActive 
                  ? 'bg-rose-600 border-rose-450 text-white active-glow-stop scale-[0.98]' 
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-rose-500 hover:text-rose-400 hover:bg-rose-950/10'
              }`}
            >
              <CircleDot className={`w-10 h-10 md:w-12 md:h-12 ${isStopActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] font-mono tracking-widest mt-1 font-bold">STOP</span>
              <kbd className="hidden md:inline-block font-mono text-[9px] mt-1 bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400">[SPACE]</kbd>
            </motion.button>

            {/* Row 2 / Col 3: RIGHT */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseDown={() => handleButtonPress('right')}
              onMouseUp={handleButtonRelease}
              onMouseLeave={handleButtonRelease}
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('right'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonRelease(); }}
              className={`w-full aspect-square flex flex-col items-center justify-center rounded-2xl md:rounded-3xl cursor-pointer transition-all duration-150 border-2 select-none ${
                isRightActive 
                  ? 'bg-emerald-600 border-emerald-400 text-white active-glow-left-right scale-[0.98]' 
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/10'
              }`}
            >
              <ArrowRight className={`w-8 h-8 md:w-10 md:h-10 transition-transform ${isRightActive ? 'translate-x-[2px]' : ''}`} />
              <span className="text-[10px] font-mono tracking-widest mt-1 font-bold">RIGHT</span>
              <kbd className="hidden md:inline-block font-mono text-[9px] mt-1 bg-slate-800/80 px-1 py-0.5 rounded text-slate-400">[D]</kbd>
            </motion.button>

            {/* Row 3 / Col 1: Empty */}
            <div />

            {/* Row 3 / Col 2: BACKWARD */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseDown={() => handleButtonPress('backward')}
              onMouseUp={handleButtonRelease}
              onMouseLeave={handleButtonRelease}
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('backward'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonRelease(); }}
              className={`w-full aspect-square flex flex-col items-center justify-center rounded-2xl md:rounded-3xl cursor-pointer transition-all duration-150 border-2 select-none ${
                isBackwardActive 
                  ? 'bg-amber-600 border-amber-400 text-white active-glow-backward scale-[0.98]' 
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500 hover:text-amber-400 hover:bg-amber-950/10'
              }`}
            >
              <ArrowDown className={`w-8 h-8 md:w-10 md:h-10 transition-transform ${isBackwardActive ? 'translate-y-[2px]' : ''}`} />
              <span className="text-[10px] font-mono tracking-widest mt-1 font-bold">REVERSE</span>
              <kbd className="hidden md:inline-block font-mono text-[9px] mt-1 bg-slate-800/80 px-1 py-0.5 rounded text-slate-400">[S]</kbd>
            </motion.button>

            {/* Row 3 / Col 3: Empty */}
            <div />

          </div>

          {/* Interactive Keyboard Instructions Helper Footer inside remote */}
          <div className="absolute bottom-3 text-center text-[10px] text-slate-500 font-mono">
            🕹️ Tip: Use computer Arrow Keys or WASD for real-time play!
          </div>
        </div>
      </main>

      {/* Latency Logs & Telemetry Analytics Panel on Right */}
      <aside className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Connection status warning */}
        {isUrlValid === false && (
          <div className="bg-rose-950/30 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-rose-200">Firebase URL Connection Offline</span>
              <p className="text-[11px] text-rose-300/80 leading-relaxed font-mono">
                The current controller database URL did not respond to ping checks. Double-check your URL, database permissions rules, and try again.
              </p>
            </div>
          </div>
        )}

        {/* Real-time Graph/Oscilloscope Display mock of control traffic */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-white uppercase font-mono font-bold tracking-wider">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>RF Telemetry Output</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              <Zap className="w-3 h-3 animate-pulse" />
              TX LIVE
            </span>
          </div>

          {/* Simple virtual canvas mock waveform based on command */}
          <div className="h-16 bg-slate-950 border border-slate-800 rounded-lg relative overflow-hidden flex items-end">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full text-emerald-500/40">
              <path 
                d={
                  currentCommand === 'forward' 
                    ? "M 0 15 Q 10 5, 20 25 T 40 15 T 60 15 T 80 15 T 100 15"
                    : currentCommand === 'backward'
                    ? "M 0 15 Q 10 25, 20 5 T 40 15 T 60 15 T 80 15 T 100 15"
                    : currentCommand === 'left' || currentCommand === 'right'
                    ? "M 0 15 Q 5 2, 10 28 T 20 15 T 30 28 T 40 15 T 50 28 T 60 15 T 100 15"
                    : "M 0 15 L 100 15" /* FLAT FOR STOP */
                } 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
                className={`transition-all duration-300 ${currentCommand !== 'stop' ? 'animate-[dash_1s_infinite_linear]' : ''}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[9px] font-mono text-slate-500 select-none bg-slate-950/80 px-1 rounded border border-slate-800">
                WAVESTATE: {currentCommand === 'stop' ? 'IDLE' : 'TRANSMITTING'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Commands Audit Logs list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs text-white uppercase font-mono font-bold tracking-wider">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Network Log ({logs.length})</span>
            </div>
            {logs.length > 0 && (
              <button 
                onClick={clearLogs}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 font-mono transition-colors border border-slate-800 hover:border-rose-500/30 px-1.5 py-0.5 rounded cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Logs scrollable box */}
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono">
                  No commands sent trace. Use controls above to drive.
                </div>
              ) : (
                logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex justify-between items-center bg-slate-950 border p-2 rounded-lg text-xs font-mono transition-colors ${
                      log.success ? 'border-slate-800' : 'border-rose-900 bg-rose-950/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        log.command === 'forward' ? 'bg-blue-500' :
                        log.command === 'backward' ? 'bg-amber-500' :
                        log.command === 'left' || log.command === 'right' ? 'bg-emerald-500' :
                        'bg-rose-500'
                      }`} />
                      <span className="text-[11px] text-slate-300 capitalize font-semibold tracking-wider">
                        {log.command}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{log.timestamp}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        log.success 
                          ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' 
                          : 'bg-rose-950/50 text-rose-400 border border-rose-900'
                      }`}>
                        {log.success ? `${log.latency}ms` : 'ERR!'}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

      </aside>

    </div>
  );
}
