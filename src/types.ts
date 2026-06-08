/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DrivingCommand = 'forward' | 'backward' | 'left' | 'right' | 'stop';

export type ControlMode = 'toggle' | 'hold';

export type ConnectionStatus = 'idle' | 'sending' | 'success' | 'error';

export interface CommandLog {
  id: string;
  timestamp: string;
  command: DrivingCommand;
  success: boolean;
  latency: number; // millisecond duration of request
  error?: string;
}
