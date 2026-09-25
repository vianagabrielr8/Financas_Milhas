export const normalizarBusca = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
