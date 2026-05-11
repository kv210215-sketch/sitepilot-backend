import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

// Minimal ArgumentsHost factory — no NestJS runtime needed
function makeHost(
  method = 'GET',
  url = '/test',
  rid?: string,
): { host: ArgumentsHost; json: jest.Mock; statusFn: jest.Mock } {
  const json = jest.fn();
  const statusFn = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusFn }),
      getRequest: () => ({
        method,
        url,
        headers: rid ? { 'x-request-id': rid } : {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, statusFn };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let savedEnv: string | undefined;

  beforeEach(() => {
    // Silence the internal NestJS Logger so test output is clean
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter = new AllExceptionsFilter();
    savedEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = savedEnv;
    jest.restoreAllMocks();
  });

  // ── Status codes ───────────────────────────────────────────────────────

  it('uses the status from an HttpException', () => {
    const { host, statusFn } = makeHost();
    filter.catch(new HttpException('Not Found', 404), host);
    expect(statusFn).toHaveBeenCalledWith(404);
  });

  it('uses 500 for a plain Error (non-HttpException)', () => {
    const { host, statusFn } = makeHost();
    filter.catch(new Error('unexpected'), host);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('uses 500 for a thrown string', () => {
    const { host, statusFn } = makeHost();
    filter.catch('something went wrong', host);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  // ── Response envelope shape ────────────────────────────────────────────

  it('response body contains statusCode, timestamp, path, message', () => {
    const { host, json } = makeHost('POST', '/auth/login');
    filter.catch(new HttpException('Bad Request', 400), host);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.path).toBe('/auth/login');
    expect(body.message).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  // ── requestId propagation ──────────────────────────────────────────────

  it('includes requestId in body when x-request-id header is present', () => {
    const { host, json } = makeHost('GET', '/projects', 'trace-abc-123');
    filter.catch(new HttpException('Forbidden', 403), host);
    expect(json.mock.calls[0][0].requestId).toBe('trace-abc-123');
  });

  it('omits requestId from body when header is absent', () => {
    const { host, json } = makeHost('GET', '/projects');
    filter.catch(new HttpException('Forbidden', 403), host);
    expect(json.mock.calls[0][0].requestId).toBeUndefined();
  });

  // ── Production message masking ─────────────────────────────────────────

  it('masks a 5xx HttpException message in production', () => {
    process.env.NODE_ENV = 'production';
    const { host, json } = makeHost();
    filter.catch(new HttpException('pool is saturated — internal detail', 503), host);
    expect(json.mock.calls[0][0].message).toBe('Internal server error');
  });

  it('exposes a 5xx HttpException message in development', () => {
    process.env.NODE_ENV = 'development';
    const { host, json } = makeHost();
    filter.catch(new HttpException('pool is saturated — internal detail', 503), host);
    // Raw HttpException message must reach the client in dev
    expect(json.mock.calls[0][0].message).not.toBe('Internal server error');
  });

  it('does NOT mask a 4xx message in production', () => {
    process.env.NODE_ENV = 'production';
    const { host, json } = makeHost();
    filter.catch(new HttpException('Email already exists', 409), host);
    expect(json.mock.calls[0][0].message).not.toBe('Internal server error');
  });

  // ── Logger interaction ─────────────────────────────────────────────────

  it('calls logger.error for 5xx exceptions', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host } = makeHost();
    filter.catch(new Error('db timeout'), host);
    expect(logSpy).toHaveBeenCalled();
  });

  it('does NOT call logger.error for 4xx exceptions', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host } = makeHost();
    filter.catch(new HttpException('Not Found', 404), host);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
