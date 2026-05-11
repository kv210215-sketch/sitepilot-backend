import { LoggerService, Injectable } from '@nestjs/common';

const RESET = '\x1b[0m';
const FG: Record<string, string> = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function colorize(color: string, text: string): string {
  return `${FG[color] ?? ''}${text}${RESET}`;
}

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

const LEVEL_COLOR: Record<LogLevel, string> = {
  log: 'green',
  error: 'red',
  warn: 'yellow',
  debug: 'magenta',
  verbose: 'gray',
};

/**
 * Structured logger:
 *  - Production: newline-delimited JSON to stdout (parsed by Railway / log aggregators)
 *  - Development: colored NestJS-style text output
 *
 * Usage: pass `new AppLoggerService()` to NestFactory.create({ logger })
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly pid = process.pid;

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const timestamp = new Date().toISOString();
    const msg = typeof message === 'string' ? message : JSON.stringify(message);

    if (this.isProduction) {
      const entry: Record<string, unknown> = {
        level,
        message: msg,
        timestamp,
        pid: this.pid,
      };
      if (context) entry['context'] = context;
      if (trace) entry['trace'] = trace;
      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      const ts = colorize('gray', timestamp);
      const lvl = colorize(LEVEL_COLOR[level], level.toUpperCase().padEnd(7));
      const ctx = context ? colorize('cyan', `[${context}]`) : '';
      const out = `${ts} ${lvl} ${ctx} ${msg}`;
      if (level === 'error') {
        process.stderr.write(out + (trace ? `\n${trace}` : '') + '\n');
      } else {
        process.stdout.write(out + '\n');
      }
    }
  }
}
