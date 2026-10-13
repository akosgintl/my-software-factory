// The one definition of "this app's own address". The app is personal and listens on 127.0.0.1
// only, but a foreign hostname can be made to resolve to 127.0.0.1 (DNS rebinding), and the browser
// then sends that foreign name in the Host header. Every route, page and API alike, is refused unless
// the Host is a local name: see proxy.ts (all requests) and guard() in api.ts (the API, again).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalHost(host: string | null | undefined): boolean {
  const hostname = (host ?? '').replace(/:\d+$/, '').toLowerCase();
  return LOCAL_HOSTS.has(hostname);
}

export const NOT_LOCAL_MESSAGE = 'This app only answers on its local address.';
