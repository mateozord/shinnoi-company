// Página /shinnoi.html: só a vista 3D, com a caixa de missão e mensagens.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import { OfficeStore } from '../net/store';
import { createOffice3D } from './office3d';
import { setupPanels } from './panels';

const store = new OfficeStore({ mock: new URLSearchParams(location.search).has('mock') });
const conn = document.getElementById('conn')!;
const toast = document.getElementById('toast')!;
store.on('connection', (c) => { conn.textContent = c === 'open' || c === 'mock' ? 'ao vivo' : c === 'connecting' ? 'conectando…' : 'sem conexão'; });
const { openMessage } = setupPanels(store);
createOffice3D({
  canvas: document.getElementById('scene') as HTMLCanvasElement,
  labels: document.getElementById('labels')!,
  store,
  onPick: openMessage,
  onActivity: (t) => { toast.textContent = t; },
});
store.connect();
