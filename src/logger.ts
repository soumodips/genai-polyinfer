export function log(...args: any[]) {
  if (process.env.POLYINFER_LOG === 'false') return;
  console.log('[polyinfer]', ...args);
}
