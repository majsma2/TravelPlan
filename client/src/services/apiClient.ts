import axios from 'axios';

/** 读取访问令牌：优先 URL ?t=，回退 localStorage */
function getToken(): string {
  const fromUrl = new URLSearchParams(location.search).get('t');
  if (fromUrl) {
    localStorage.setItem('tp_token', fromUrl);
    return fromUrl;
  }
  return localStorage.getItem('tp_token') || '';
}

/** 保存令牌并同步到 URL（用于跨设备分享链接） */
export function setToken(token: string): void {
  localStorage.setItem('tp_token', token);
  const url = new URL(location.href);
  url.searchParams.set('t', token);
  history.replaceState(null, '', url.toString());
}

export const apiClient = axios.create({ baseURL: '/api' });

apiClient.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers['x-trip-token'] = t;
  return cfg;
});
