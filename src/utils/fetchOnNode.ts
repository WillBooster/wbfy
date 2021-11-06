import type { RequestInfo, Response, RequestInit } from 'node-fetch';

export async function fetchOnNode(url: RequestInfo, init?: RequestInit | undefined): Promise<Response> {
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(url, init);
}
