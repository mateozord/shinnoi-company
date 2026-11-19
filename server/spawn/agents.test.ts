import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { agentFile, createAgent, listAgents, parseAgent, slugify } from './agents';

describe('agentes do projeto', () => {
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('slugify tira acento e símbolos', () => {
    expect(slugify('Editor de Vídeo!')).toBe('editor-de-video');
    expect(slugify('!!!')).toBe('');
  });

  it('agentFile e parseAgent fazem ida e volta, com descrição em uma linha', () => {
    const md = agentFile({ name: 'roteirista', description: 'Escreve\nroteiros', model: 'opus', prompt: 'Você é...' });
    expect(parseAgent(md)).toEqual({ name: 'roteirista', description: 'Escreve roteiros', model: 'opus' });
  });

  it('cria, lista e recusa nome repetido ou campos vazios', () => {
    dir = mkdtempSync(join(tmpdir(), 'shinnoi-'));
    expect(createAgent(dir, { name: 'Roteirista', description: 'roteiros', model: 'x', prompt: 'Você é um roteirista.' })).toEqual({ ok: true, name: 'roteirista' });
    expect(readFileSync(join(dir, '.claude', 'agents', 'roteirista.md'), 'utf8')).toContain('model: sonnet');
    expect(listAgents(dir)).toEqual([{ name: 'roteirista', description: 'roteiros', model: 'sonnet' }]);
    expect(createAgent(dir, { name: 'roteirista', description: 'a', model: 'opus', prompt: 'b' })).toHaveProperty('error');
    expect(createAgent(dir, { name: 'novo', description: '', model: 'opus', prompt: 'b' })).toHaveProperty('error');
  });
});
