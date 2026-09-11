// 简单日志工具，带时间戳与标签
type Level = 'info' | 'warn' | 'error';
function stamp(level: Level, tag: string, msg: string, extra?: unknown) {
  const t = new Date().toISOString();
  const line = `[${t}] [${level.toUpperCase()}] [${tag}] ${msg}`;
  if (extra !== undefined) {
    console[level](line, extra);
  } else {
    console[level](line);
  }
}

export const logger = {
  info: (tag: string, msg: string, extra?: unknown) => stamp('info', tag, msg, extra),
  warn: (tag: string, msg: string, extra?: unknown) => stamp('warn', tag, msg, extra),
  error: (tag: string, msg: string, extra?: unknown) => stamp('error', tag, msg, extra),
};
