// Shinnoi Company: agentes do projeto (.claude/agents/<nome>.md, o formato de subagente do Claude Code). A página
// lista e cria agentes só dentro dos projetos cadastrados (shinnoi.projects.json): é a trava contra gravar arquivo em
// qualquer pasta do computador.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MODELS = ['opus', 'sonnet', 'haiku'] as const;
export type AgentModel = (typeof MODELS)[number];

export interface ProjectAgent {
  name: string;
  description: string;
  model?: string;
}

/** "Editor de Vídeo!" -> "editor-de-video" (o nome do arquivo e do subagente). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Lê name/description/model do cabeçalho YAML simples de um .md de agente. */
export function parseAgent(md: string): ProjectAgent | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return null;
  const field = (k: string) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(m[1])?.[1].trim();
  const name = field('name');
  if (!name) return null;
  return { name, description: field('description') ?? '', model: field('model') };
}

/** Monta o .md do agente (uma linha por campo do cabeçalho: quebras de linha viram espaço). */
export function agentFile(a: { name: string; description: string; model: AgentModel; prompt: string }): string {
  const one = (s: string) => s.replace(/\s+/g, ' ').trim();
  return `---\nname: ${a.name}\ndescription: ${one(a.description)}\nmodel: ${a.model}\n---\n\n${a.prompt.trim()}\n`;
}

export function listAgents(project: string): ProjectAgent[] {
  const dir = join(project, '.claude', 'agents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseAgent(readFileSync(join(dir, f), 'utf8')))
    .filter((a): a is ProjectAgent => !!a);
}

export function createAgent(
  project: string,
  input: { name: unknown; description: unknown; model: unknown; prompt: unknown },
): { ok: true; name: string } | { error: string } {
  const name = typeof input.name === 'string' ? slugify(input.name) : '';
  if (!name) return { error: 'dê um nome ao agente' };
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 400) : '';
  if (!description) return { error: 'descreva o trabalho do agente' };
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim().slice(0, 20_000) : '';
  if (!prompt) return { error: 'escreva as instruções do agente' };
  const model = (MODELS as readonly string[]).includes(input.model as string) ? (input.model as AgentModel) : 'sonnet';
  const dir = join(project, '.claude', 'agents');
  const file = join(dir, `${name}.md`);
  if (existsSync(file)) return { error: 'já existe um agente com esse nome' };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, agentFile({ name, description, model, prompt }));
  return { ok: true, name };
}
