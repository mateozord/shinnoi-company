// Shinnoi Company: o projeto em que você está mexendo. Com um escolhido, o escritório (salas, agentes, 3D, feed)
// mostra só o que roda dentro dessa pasta; "todos" mostra tudo. A escolha fica neste navegador.
import type { OfficeSnapshot } from '../../../shared/types';

const KEY = 'shinnoi:project';
const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

/** A pasta está dentro do projeto (ou é ele). */
export function inProject(path: string, project: string): boolean {
  const a = norm(path);
  const b = norm(project);
  return a === b || a.startsWith(`${b}/`);
}

/** Snapshot só com as salas do projeto e os agentes delas (null = sem filtro). */
export function filterSnapshot(snap: OfficeSnapshot, project: string | null): OfficeSnapshot {
  if (!project) return snap;
  const rooms = snap.rooms.filter((r) => inProject(r.path, project));
  const ids = new Set(rooms.map((r) => r.id));
  return { ...snap, rooms, agents: snap.agents.filter((a) => ids.has(a.roomId)) };
}

export function savedProject(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function saveProject(path: string | null): void {
  try {
    if (path) localStorage.setItem(KEY, path);
    else localStorage.removeItem(KEY);
  } catch {
    // sem armazenamento: vale só nesta aba
  }
}
