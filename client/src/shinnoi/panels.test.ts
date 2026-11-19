import { describe, expect, it } from 'vitest';
import { missionPrompt } from './panels';

describe('missionPrompt', () => {
  it('geral vai como está', () => {
    expect(missionPrompt('geral', 'faz X')).toBe('faz X');
  });
  it('estação chama o subagente do projeto', () => {
    expect(missionPrompt('editor', 'vídeo da geladeira')).toBe('Use o subagente "editor" (definido em .claude/agents/editor.md) para: vídeo da geladeira');
  });
});
