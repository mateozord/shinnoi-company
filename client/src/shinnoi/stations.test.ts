import { describe, expect, it } from 'vitest';
import { isActive, stationOf } from './stations';

describe('stationOf', () => {
  it('usa o tipo do subagente', () => {
    expect(stationOf({ role: 'editor' })).toBe('editor');
    expect(stationOf({ role: 'pesquisador' })).toBe('pesquisador');
    expect(stationOf({ role: 'qa' })).toBe('qa');
  });
  it('cai no título quando o tipo é genérico', () => {
    expect(stationOf({ role: 'general-purpose', title: 'QA do vídeo airfryer' })).toBe('qa');
    expect(stationOf({ role: 'general-purpose', title: 'Editor faz vídeo airfryer' })).toBe('editor');
    expect(stationOf({ role: 'general-purpose', title: 'Pesquisar próximos temas' })).toBe('pesquisador');
  });
  it('não confunde "qa" dentro de outra palavra', () => {
    expect(stationOf({ role: 'Explore', title: 'aquarela' })).toBe('geral');
  });
});

describe('isActive', () => {
  it('trabalhando ou no shell conta como ativo', () => {
    expect(isActive({ status: 'working' })).toBe(true);
    expect(isActive({ status: 'shell' })).toBe(true);
    expect(isActive({ status: 'idle' })).toBe(false);
  });
});
