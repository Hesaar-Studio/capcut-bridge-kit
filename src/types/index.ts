export type Platform = 'mac' | 'win';
export type LaneType = 'file' | 'live';

export interface CommandDefinition {
  id: string;
  name: string;
  lane: LaneType;
  description: string;
  usage: string;
  example: string;
  hardRuleRef?: string;
  args: CommandArg[];
}

export interface CommandArg {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file';
  label: string;
  defaultValue?: any;
  options?: string[];
  required?: boolean;
  help?: string;
}

export interface CutItem {
  id: string;
  source_path: string;
  start: number;
  duration: number;
  width: number;
  height: number;
  label?: string;
}

export interface GraphicsElement {
  id: string;
  type: 'text' | 'overlay';
  text?: string;
  source_path?: string;
  start: number;
  duration: number;
  style?: string;
  color?: string;
  font_size?: number;
  position?: { x: number; y: number };
}

export interface HardRuleCheck {
  id: string;
  title: string;
  description: string;
  status: 'passed' | 'warning' | 'error' | 'repaired';
  details: string;
}
