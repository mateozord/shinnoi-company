// Shinnoi Company: o mapa do meio é o escritório 3D (padrão) ou o 2D original. Escolha guardada neste navegador.
const VIEW_KEY = 'shinnoi:view';

export function view3d(): boolean {
  try {
    return localStorage.getItem(VIEW_KEY) !== '2d';
  } catch {
    return true;
  }
}

/** Troca entre 3D e 2D e recarrega (cada mapa monta a cena dele no carregamento). */
export function toggleView(): void {
  try {
    localStorage.setItem(VIEW_KEY, view3d() ? '2d' : '3d');
  } catch {
    // sem armazenamento: fica no padrão (3D)
  }
  location.reload();
}
