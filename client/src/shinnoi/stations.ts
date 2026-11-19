import type { AgentInfo } from '../../../shared/types';

export type StationId = 'editor' | 'pesquisador' | 'qa' | 'geral';

export interface StationDef {
  id: StationId;
  label: string;
  color: number;
}

export const STATIONS: readonly StationDef[] = [
  { id: 'editor', label: 'Editor', color: 0xf0a35e },
  { id: 'pesquisador', label: 'Pesquisador', color: 0x6cc7d9 },
  { id: 'qa', label: 'QA', color: 0xf2d16b },
  { id: 'geral', label: 'Geral', color: 0xb78ae0 },
];

/** Em qual mesa o subagente senta: pelo tipo (role) ou, se for genérico, pelo título da tarefa. */
export function stationOf(a: Pick<AgentInfo, 'role' | 'title'>): StationId {
  const s = `${a.role} ${a.title ?? ''}`.toLowerCase();
  if (s.includes('editor')) return 'editor';
  if (s.includes('pesquis') || s.includes('research') || s.includes('ideias')) return 'pesquisador';
  if (/\bqa\b|revisor|review/.test(s)) return 'qa';
  return 'geral';
}

export const isActive = (a: Pick<AgentInfo, 'status'>): boolean => a.status === 'working' || a.status === 'shell';
