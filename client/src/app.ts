// O app do cliente: store (dados) -> mundo (canvas) -> UI (painéis). Carregado por main.ts depois do dicionário do
// idioma ativo, porque vários módulos chamam tr() ao carregar.
import { loadAccess } from './net/access';
import { OfficeStore } from './net/store';
import { createWorld, type WorldApi } from './world';
import { createUI } from './ui';
import type { CitySceneHost } from './ui/world/scene-switch';
import type { CityScene } from './world/city';
import { migrateLegacyKeys, safeLocalStorage } from './ui/prefs';
import { getLocale, tr } from '../../shared/i18n';
import { view3d } from './shinnoi/view';

export function start(): void {
  // Antes de tudo: o mundo (carteiras) e a UI (preferências) leem o localStorage ao serem criados.
  migrateLegacyKeys(safeLocalStorage());

  // Idioma escolhido (shared/i18n): leitores de tela e o corretor do navegador seguem o atributo lang.
  document.documentElement.lang = getLocale();
  document.querySelector('meta[name="description"]')?.setAttribute(
    'content',
    tr('Escritório virtual em pixel art que mostra, em tempo real, o que seus agentes do Claude Code estão fazendo.'),
  );

  const params = new URLSearchParams(location.search);
  const store = new OfficeStore({ mock: params.has('mock') });
  const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui') as HTMLElement;
  const world = createWorld(worldCanvas, store);
  const city = cityHost({ world, worldCanvas, uiRoot, mock: store.mock, params, version: () => store.liveSnapshot?.meta.version ?? '' });
  createUI(uiRoot, store, world, city);
  if (view3d()) mount3d(world, worldCanvas, store);
  // O que esta página pode fazer (porta local ou remota com login) chega antes do primeiro snapshot (ou desiste em
  // poucos segundos e fica a regra de antes).
  if (store.mock) store.connect();
  else {
    void loadAccess().finally(() => store.connect());
    // Reconexão (servidor reiniciado, celular de volta do bloqueio): o acesso pode ter mudado, e o login pode ter
    // vencido (loadAccess leva à tela de entrada).
    let opened = false;
    store.on('connection', (state) => {
      if (state === 'open') {
        if (opened) void loadAccess();
        opened = true;
      } else if (state === 'closed' && opened) void loadAccess();
    });
  }

  // Facilita a depuração pelo console do navegador.
  Object.assign(window, { habblaud: { store, world, city } });
}

/**
 * Troca o mapa 2D pelo escritório 3D (carregado à parte: quem usa o 2D não baixa o three.js). O mundo 2D continua
 * existindo e suspenso, como dono da seleção: clicar num boneco 3D chama world.select e a gaveta do agente abre como
 * no 2D.
 */
function mount3d(world: WorldApi, worldCanvas: HTMLCanvasElement, store: OfficeStore): void {
  const canvas = document.createElement('canvas');
  canvas.className = 's3d-canvas';
  canvas.setAttribute('aria-label', tr('Escritório em 3D da Shinnoi Company'));
  const labels = document.createElement('div');
  labels.className = 's3d-labels';
  worldCanvas.after(canvas, labels);
  worldCanvas.hidden = true;
  world.setSuspended?.(true);
  void import('./shinnoi/office3d').then(({ createOffice3D }) =>
    createOffice3D({ canvas, labels, store, onPick: (id) => (id.startsWith('station:') ? void import('./shinnoi/agent-dialog').then((m) => m.stationCard(id.slice(8))) : world.select({ type: 'agent', id }, { focus: true })) }),
  );
}

/**
 * A cena da cidade do Habblaud World (botão Mundo): um segundo canvas por cima do escritório, carregado só na
 * primeira vez que abre (quem não usa o World não baixa a cidade). Com a cidade na tela, o escritório para de
 * desenhar e o teclado é da cidade; Esc ou o botão Escritório voltam.
 */
function cityHost(o: { world: WorldApi; worldCanvas: HTMLCanvasElement; uiRoot: HTMLElement; mock: boolean; params: URLSearchParams; version: () => string }): CitySceneHost & { scene(): CityScene | null } {
  let scene: CityScene | null = null;
  let loading: Promise<CityScene> | null = null;
  let open = false;
  const canvas = document.createElement('canvas');
  canvas.id = 'city';
  canvas.hidden = true;
  o.worldCanvas.after(canvas);
  const load = (): Promise<CityScene> =>
    (loading ??= Promise.all([import('./world/city'), import('./net/world-stream')]).then(([m, ws]) => {
      // Modo demonstração: a cidade de mentira (`?perf=N` enche N lotes, para medir). Ao vivo: o stream do servidor
      // local (GET /api/world/stream e POST /api/world/cmd).
      const perf = Number(o.params.get('perf'));
      const buildings = o.mock && Number.isFinite(perf) && perf > 0 ? { buildings: perf } : {};
      // a cidade falsa lembra onde eu estava entre um stream e o seguinte desta página (como o servidor, por conta)
      const memory = {};
      scene = m.createCityScene({
        canvas,
        uiRoot: o.uiRoot,
        openStream: () => ws.createWorldStream({ mock: o.mock, ...buildings, memory }),
        options: () => o.world.getOptions(),
        topInset: () => o.uiRoot.querySelector('.ui-topbar')?.getBoundingClientRect().bottom ?? 64,
        version: () => o.version(),
      });
      return scene;
    }));
  return {
    get open() {
      return open;
    },
    async show() {
      const s = await load();
      open = true;
      o.world.setSuspended?.(true);
      o.worldCanvas.hidden = true;
      s.show();
    },
    hide() {
      open = false;
      scene?.hide();
      o.worldCanvas.hidden = false;
      o.world.setSuspended?.(false);
    },
    zoomBy: (f) => scene?.zoomBy(f),
    recenter: () => scene?.recenter(),
    escape: () => scene?.escape() ?? false,
    visitOwn: () => scene?.visitOwn(),
    scene: () => scene,
  };
}
