// Painéis da vista 3D: "Nova missão" (POST /api/spawn, igual ao Novo agente do escritório) e mensagem para uma
// sessão aberta (POST /api/messages via OfficeStore).
import type { OfficeStore } from '../net/store';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `erro ${res.status}`);
  return body;
}

/** Texto da missão: "geral" vai como está; as outras chamam o subagente do projeto (.claude/agents/<id>.md). */
export function missionPrompt(who: string, task: string): string {
  return who === 'geral' ? task : `Use o subagente "${who}" (definido em .claude/agents/${who}.md) para: ${task}`;
}

interface SpawnInfo { id: string; status: string; how?: string; error?: string }

export function setupPanels(store: OfficeStore): { openMessage: (agentId: string) => void } {
  const form = $<HTMLFormElement>('mission');
  const who = $<HTMLSelectElement>('m-who');
  const folder = $<HTMLSelectElement>('m-folder');
  const text = $<HTMLTextAreaElement>('m-text');
  const status = $<HTMLParagraphElement>('m-status');
  const send = form.querySelector('button')!;
  // "Para quem": os agentes do projeto escolhido (.claude/agents) + Geral
  const loadWho = () => {
    who.replaceChildren(new Option('Geral (sem agente fixo)', 'geral'));
    if (!folder.value) return;
    json<{ agents: { name: string }[] }>(`/api/spawn/agents?project=${encodeURIComponent(folder.value)}`)
      .then(({ agents }) => { for (const a of agents) who.append(new Option(a.name, a.name)); })
      .catch(() => {});
  };
  folder.addEventListener('change', loadWho);

  void json<{ folders: { path: string; name: string }[] }>('/api/spawn/folders')
    .then(({ folders }) => {
      for (const f of folders) folder.append(new Option(f.name, f.path));
      const lofi = folders.find((f) => f.name === 'lofi-animations');
      if (lofi) folder.value = lofi.path;
      loadWho();
    })
    .catch((e: Error) => { status.textContent = `Pastas: ${e.message}`; });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const task = text.value.trim();
    if (!task || !folder.value) return;
    status.textContent = 'Enviando…';
    send.disabled = true;
    void (async () => {
      try {
        let r = await json<SpawnInfo>('/api/spawn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: folder.value, prompt: missionPrompt(who.value, task) }),
        });
        for (let i = 0; i < 30 && (r.status === 'queued' || r.status === 'sent'); i++) {
          await new Promise((ok) => setTimeout(ok, 1500));
          r = await json<SpawnInfo>(`/api/spawn/${encodeURIComponent(r.id)}`);
        }
        if (r.status === 'opened') {
          status.textContent = r.how === 'cli' ? 'Missão começou! O agente aparece aqui em instantes.' : 'Abri no app do Claude: aperte Enter lá.';
          text.value = '';
        } else status.textContent = `Não começou: ${r.error ?? r.status}`;
      } catch (e) {
        status.textContent = `Erro: ${(e as Error).message}`;
      } finally {
        send.disabled = false;
      }
    })();
  });

  const dlg = $<HTMLDialogElement>('msg');
  const msgText = $<HTMLTextAreaElement>('msg-text');
  const msgTo = $<HTMLSpanElement>('msg-to');
  const msgStatus = $<HTMLParagraphElement>('msg-status');
  let target = '';
  $<HTMLFormElement>('msg-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if ((ev.submitter as HTMLButtonElement | null)?.value === 'cancel') return dlg.close();
    const t = msgText.value.trim();
    if (!t) return;
    msgStatus.textContent = 'Enviando…';
    store
      .sendMessage(target, t)
      .then((r) => {
        if ('error' in r) msgStatus.textContent = `Não foi: ${r.error}`;
        else {
          msgStatus.textContent = 'Enviada! Chega na próxima pausa do agente.';
          msgText.value = '';
        }
      })
      .catch((e: Error) => { msgStatus.textContent = `Erro: ${e.message}`; });
  });

  return {
    openMessage(agentId) {
      target = agentId;
      const a = store.agent(agentId);
      msgTo.textContent = a?.title ?? a?.name ?? agentId;
      msgStatus.textContent = '';
      msgText.value = '';
      dlg.showModal();
    },
  };
}
