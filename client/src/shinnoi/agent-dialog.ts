// Shinnoi Company: janela "Agentes" da barra do topo. Lista os agentes do projeto (.claude/agents) com "Dar missão"
// (abre uma sessão nova pelo /api/spawn chamando o agente) e cria agentes novos a partir de um modelo de instruções.
// Só a Shinnoi usa esta janela, em português: textos diretos, sem passar pelo dicionário do Habblaud.
import { missionPrompt } from './panels';
import { savedProject } from './project';
import { STATIONS, stationOf } from './stations';

interface Folder { name: string; path: string }
interface Agent { name: string; description: string; model?: string }

/** Modelo de instruções do agente, montado do nome e do trabalho (o usuário edita à vontade). */
export function promptTemplate(name: string, job: string): string {
  const who = name.trim() || 'o agente';
  const what = job.trim() || '<descreva a especialidade>';
  return [
    `Você é ${who}, especialista em ${what}.`,
    '',
    '## Como trabalhar',
    '- Responda em português, curto e direto.',
    '- Antes de mudar algo, leia os arquivos do projeto que tratam do assunto e siga o estilo que já existe.',
    '- Confira os fatos; se não tiver certeza, diga o que não conseguiu verificar.',
    '',
    '## Entrega',
    '- O que você fez, onde ficou (caminho dos arquivos) e o que ficou pendente.',
  ].join('\n');
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `erro ${res.status}`);
  return body;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}

export function agentsButton(): HTMLButtonElement {
  const btn = el('button', { type: 'button', className: 'ui-view3d', textContent: '+ Agente', title: 'Criar agentes e dar missões' });
  let dlg: HTMLDialogElement | null = null;
  btn.addEventListener('click', () => {
    dlg ??= build();
    dlg.showModal();
  });
  return btn;
}

function build(): HTMLDialogElement {
  const project = el('select', { id: 'sa-project' });
  const list = el('ul', { className: 's-agents__list' });
  const listStatus = el('p', { className: 's-agents__status' });
  const name = el('input', { id: 'sa-name', required: true, maxLength: 40, placeholder: 'ex.: roteirista' });
  const job = el('input', { id: 'sa-job', required: true, maxLength: 400, placeholder: 'ex.: roteiros curtos com gancho forte nos 2 primeiros segundos' });
  const model = el('select', { id: 'sa-model' });
  for (const [v, t] of [['sonnet', 'Sonnet (equilibrado)'], ['opus', 'Opus (mais caprichado, gasta mais)'], ['haiku', 'Haiku (rápido e barato)']]) model.append(new Option(t, v));
  const prompt = el('textarea', { id: 'sa-prompt', required: true, rows: 10 });
  const status = el('p', { className: 's-agents__status', role: 'status' });
  let edited = false;
  const refreshTemplate = () => { if (!edited) prompt.value = promptTemplate(name.value, job.value); };
  name.addEventListener('input', refreshTemplate);
  job.addEventListener('input', refreshTemplate);
  prompt.addEventListener('input', () => { edited = true; });
  refreshTemplate();

  const label = (forId: string, text: string) => el('label', { htmlFor: forId, textContent: text });
  const form = el(
    'form',
    { className: 's-agents__form' },
    el('h3', { textContent: 'Novo agente do projeto' }),
    label('sa-name', 'Nome'), name,
    label('sa-job', 'Trabalho (especialista em…)'), job,
    label('sa-model', 'Modelo'), model,
    label('sa-prompt', 'Instruções (já vem um modelo pronto)'), prompt,
    el('button', { type: 'submit', className: 's-agents__primary', textContent: 'Criar agente' }),
    status,
  );
  const close = el('button', { type: 'button', className: 's-agents__close', textContent: '✕', title: 'Fechar' });
  const dlg = el(
    'dialog',
    { className: 's-agents' },
    el('div', { className: 's-agents__head' }, el('h2', { textContent: 'Agentes' }), close),
    label('sa-project', 'Projeto'), project,
    el('h3', { textContent: 'Agentes deste projeto' }), list, listStatus,
    form,
  );
  close.addEventListener('click', () => dlg.close());
  document.body.append(dlg);

  const loadAgents = () => {
    list.replaceChildren();
    listStatus.textContent = 'Carregando…';
    json<{ agents: Agent[] }>(`/api/spawn/agents?project=${encodeURIComponent(project.value)}`)
      .then(({ agents }) => {
        listStatus.textContent = agents.length ? '' : 'Nenhum agente ainda. Crie o primeiro abaixo.';
        for (const a of agents) list.append(agentRow(a, project.value));
      })
      .catch((e: Error) => { listStatus.textContent = e.message; });
  };
  project.addEventListener('change', loadAgents);
  void json<{ folders: Folder[] }>('/api/spawn/folders').then(({ folders }) => {
    for (const f of folders) project.append(new Option(f.name, f.path));
    const cur = savedProject();
    if (cur && folders.some((f) => f.path === cur)) project.value = cur;
    loadAgents();
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    status.textContent = 'Criando…';
    json<{ name: string }>('/api/spawn/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project.value, name: name.value, description: job.value, model: model.value, prompt: prompt.value }),
    })
      .then((r) => {
        status.textContent = `Agente "${r.name}" criado! Já dá para dar missões a ele.`;
        form.reset();
        edited = false;
        refreshTemplate();
        loadAgents();
      })
      .catch((e: Error) => { status.textContent = e.message; });
  });
  return dlg;
}

function agentRow(a: Agent, project: string): HTMLLIElement {
  const task = el('input', { placeholder: `missão para ${a.name}…`, maxLength: 2000 });
  task.setAttribute('aria-label', `Missão para ${a.name}`);
  const go = el('button', { type: 'button', className: 's-agents__primary', textContent: 'Dar missão' });
  const st = el('small');
  go.addEventListener('click', () => {
    const t = task.value.trim();
    if (!t) return task.focus();
    go.disabled = true;
    st.textContent = 'Enviando…';
    json<{ id: string; status: string; how?: string; error?: string }>('/api/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: project, prompt: missionPrompt(a.name, t) }),
    })
      .then(async (r) => {
        for (let i = 0; i < 30 && (r.status === 'queued' || r.status === 'sent'); i++) {
          await new Promise((ok) => setTimeout(ok, 1500));
          r = await json(`/api/spawn/${encodeURIComponent(r.id)}`);
        }
        st.textContent = r.status === 'opened' ? 'Missão começou!' : `Não começou: ${r.error ?? r.status}`;
        if (r.status === 'opened') task.value = '';
      })
      .catch((e: Error) => { st.textContent = e.message; })
      .finally(() => { go.disabled = false; });
  });
  return el(
    'li',
    {},
    el('div', {}, el('b', { textContent: a.name }), el('span', { textContent: ` · ${a.model ?? 'padrão'}` })),
    el('p', { textContent: a.description }),
    el('div', { className: 's-agents__mission' }, task, go),
    st,
  );
}

/** Card de uma estação 3D sem sessão rodando: mostra os agentes do projeto daquela mesa (LLM, função) e "Dar missão". */
export function stationCard(station: string): void {
  const project = savedProject();
  const title = STATIONS.find((d) => d.id === station)?.label ?? station;
  const body = el('div', {}, el('p', { className: 's-agents__status', textContent: 'Carregando…' }));
  const close = el('button', { type: 'button', className: 's-agents__close', textContent: '✕', title: 'Fechar' });
  const dlg = el('dialog', { className: 's-agents' }, el('div', { className: 's-agents__head' }, el('h2', { textContent: title }), close), body);
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  if (!project) {
    body.replaceChildren(el('p', { className: 's-agents__status', textContent: 'Escolha um projeto na barra do topo para ver os agentes desta mesa.' }));
    return;
  }
  json<{ agents: Agent[] }>(`/api/spawn/agents?project=${encodeURIComponent(project)}`)
    .then(({ agents }) => {
      // pelo nome primeiro: a descrição do QA cita "editor" e o levaria para a mesa errada
      const deskOf = (a: Agent) => { const byName = stationOf({ role: a.name }); return byName !== 'geral' ? byName : stationOf({ role: '', title: a.description }); };
      const mine = agents.filter((a) => deskOf(a) === station);
      if (!mine.length) return body.replaceChildren(el('p', { className: 's-agents__status', textContent: 'Nenhum agente deste projeto nesta mesa. Crie um em "+ Agente".' }));
      body.replaceChildren(
        ...mine.flatMap((a) => [
          el('div', { className: 's-card' },
            el('div', { className: 's-card__tile' }, el('span', { textContent: 'Agente' }), el('b', { textContent: a.name })),
            el('div', { className: 's-card__tile' }, el('span', { textContent: 'LLM' }), el('b', { textContent: a.model ?? 'padrão' })),
            el('div', { className: 's-card__tile s-card__tile--wide' }, el('span', { textContent: 'Fazendo agora' }), el('b', { textContent: 'Parado (sem missão rodando)' })),
            el('div', { className: 's-card__tile s-card__tile--wide' }, el('span', { textContent: 'Função' }), el('b', { textContent: a.description })),
          ),
          el('ul', { className: 's-agents__list' }, withoutDescription(agentRow(a, project))),
        ]),
      );
    })
    .catch((e: Error) => body.replaceChildren(el('p', { className: 's-agents__status', textContent: e.message })));
}

function withoutDescription(row: HTMLLIElement): HTMLLIElement {
  row.querySelector('p')?.remove();
  return row;
}
