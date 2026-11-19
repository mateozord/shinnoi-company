import { describe, expect, it } from 'vitest';
import type { OfficeSnapshot } from '../../../shared/types';
import { filterSnapshot, inProject } from './project';

describe('inProject', () => {
  it('aceita a própria pasta e subpastas, ignorando barras e maiúsculas', () => {
    expect(inProject('C:\\Docs\\canais\\ze', 'c:/docs/canais/ze')).toBe(true);
    expect(inProject('C:\\Docs\\canais\\ze\\ep_gelo', 'C:\\Docs\\canais\\ze\\')).toBe(true);
  });
  it('não confunde pasta com prefixo parecido', () => {
    expect(inProject('C:/Docs/canais/ze_explora2', 'C:/Docs/canais/ze_explora')).toBe(false);
  });
});

describe('filterSnapshot', () => {
  const snap = {
    rooms: [{ id: 'r1', path: 'C:/p/ze' }, { id: 'r2', path: 'C:/p/manual' }],
    agents: [{ id: 'a', roomId: 'r1' }, { id: 'b', roomId: 'r2' }],
  } as unknown as OfficeSnapshot;
  it('sem projeto devolve tudo', () => {
    expect(filterSnapshot(snap, null)).toBe(snap);
  });
  it('com projeto deixa só as salas e agentes dele', () => {
    const f = filterSnapshot(snap, 'C:/p/manual');
    expect(f.rooms.map((r) => r.id)).toEqual(['r2']);
    expect(f.agents.map((a) => a.id)).toEqual(['b']);
  });
});
