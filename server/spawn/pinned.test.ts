import { describe, expect, it } from 'vitest';
import { pinnedFolders } from './folders';

describe('pinnedFolders', () => {
  it('usa os projetos do arquivo, na ordem, com o horário dos recentes', () => {
    const recent = [{ path: 'C:/a/ze', name: 'ze', lastAt: 5, sessions: 2 }];
    expect(pinnedFolders([{ name: 'Zé Explora', path: 'C:/a/ze' }, { name: 'Manual', path: 'C:/a/m' }], recent)).toEqual([
      { path: 'C:/a/ze', name: 'Zé Explora', lastAt: 5, sessions: 2 },
      { path: 'C:/a/m', name: 'Manual', lastAt: 0, sessions: 0 },
    ]);
  });
  it('arquivo inválido ou vazio volta para os recentes (null)', () => {
    expect(pinnedFolders({}, [])).toBeNull();
    expect(pinnedFolders([{ name: 'x', path: 'relativo' }], [])).toBeNull();
  });
});
