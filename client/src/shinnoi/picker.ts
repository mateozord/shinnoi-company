// Shinnoi Company: seletor de projeto na barra do topo. Lista os projetos fixos (GET /api/spawn/folders, que lê o
// shinnoi.projects.json), "Todos os projetos" e "Cadastrar projeto…" (POST /api/spawn/projects). Trocar recarrega a
// página já filtrada (store.ts + project.ts), para o mapa, a lista e o feed começarem do zero no projeto novo.
import { tr } from '../../../shared/i18n';
import { saveProject, savedProject } from './project';

const ALL = '';
const ADD = '__add__';

export function projectPicker(): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = 'ui-project';
  sel.setAttribute('aria-label', tr('Projeto'));
  const current = savedProject();

  const fill = (folders: { name: string; path: string }[]) => {
    sel.replaceChildren(new Option(tr('Todos os projetos'), ALL));
    for (const f of folders) sel.append(new Option(f.name, f.path));
    // projeto salvo que saiu da lista continua aparecendo, para não sumir sem aviso
    if (current && !folders.some((f) => f.path === current)) sel.append(new Option(current, current));
    sel.append(new Option(tr('+ Cadastrar projeto…'), ADD));
    sel.value = current ?? ALL;
  };
  const load = () =>
    fetch('/api/spawn/folders')
      .then((r) => (r.ok ? (r.json() as Promise<{ folders: { name: string; path: string }[] }>) : { folders: [] }))
      .then(({ folders }) => fill(folders))
      .catch(() => fill([]));
  void load();

  sel.addEventListener('change', () => {
    if (sel.value !== ADD) {
      saveProject(sel.value || null);
      location.reload();
      return;
    }
    sel.value = current ?? ALL;
    const name = prompt(tr('Nome do projeto (ex.: Zé Explora)'))?.trim();
    if (!name) return;
    const path = prompt(tr('Caminho completo da pasta (copie da barra de endereço do Explorador de Arquivos)'))?.trim();
    if (!path) return;
    void fetch('/api/spawn/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, path }) })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) alert(body.error ?? tr('erro {0}', [r.status]));
        else void load();
      })
      .catch((e: Error) => alert(e.message));
  });
  return sel;
}
