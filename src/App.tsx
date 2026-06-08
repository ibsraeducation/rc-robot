/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Controller from './components/Controller';
import { Cpu } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-start">
      {/* Background neon visual ambient highlight */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Main app nav heading */}
      <header className="w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-widest text-slate-200">
              ROBOTIC TELEMETRY SYSTEM
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              UTC TIMELOCK
            </span>
            <span className="text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              2026-06-08
            </span>
          </div>
        </div>
      </header>

      {/* Controller body container */}
      <div className="relative z-10 flex-1 flex flex-col justify-center py-4">
        <Controller />
      </div>

      {/* Standard humble minimal footer */}
      <footer className="w-full text-center py-6 text-[10px] text-slate-500 font-mono border-t border-slate-900/60 mt-auto bg-slate-950">
        <span>© 2026 ESP32 Realtime Controller Panel • Connected via Firebase DB</span>
      </footer>
    </div>
  );
}

