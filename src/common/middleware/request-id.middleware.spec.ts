import { RequestIdMiddleware, REQUEST_ID_HEADER } from './request-id.middleware';
import { Request, Response } from 'express';

// UUID v4 pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeReq(existingId?: string): Request {
  return {
    headers: existingId ? { [REQUEST_ID_HEADER]: existingId } : {},
  } as unknown as Request;
}

function makeRes(): { res: Response; setHeader: jest.Mock } {
  const setHeader = jest.fn();
  return { res: { setHeader } as unknown as Response, setHeader };
}

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    next = jest.fn();
  });

  it('generates a valid UUID v4 when no header is present', () => {
    const req = makeReq();
    const { res } = makeRes();
    middleware.use(req, res, next);
    expect(req.headers[REQUEST_ID_HEADER]).toMatch(UUID_REGEX);
  });

  it('preserves a supplied X-Request-Id from the client', () => {
    const req = makeReq('my-client-trace-42');
    const { res } = makeRes();
    middleware.use(req, res, next);
    expect(req.headers[REQUEST_ID_HEADER]).toBe('my-client-trace-42');
  });

  it('echoes the request-id back in the response header', () => {
    const req = makeReq('echo-me');
    const { res, setHeader } = makeRes();
    middleware.use(req, res, next);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'echo-me');
  });

  it('generates a new UUID when the header value is an empty string', () => {
    const req = makeReq('');
    const { res } = makeRes();
    middleware.use(req, res, next);
    expect(req.headers[REQUEST_ID_HEADER]).toMatch(UUID_REGEX);
  });

  it('always calls next()', () => {
    const req = makeReq();
    const { res } = makeRes();
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // called with no arguments
  });

  it('two requests without headers receive different IDs', () => {
    const req1 = makeReq();
    const req2 = makeReq();
    const { res } = makeRes();
    middleware.use(req1, res, jest.fn());
    middleware.use(req2, res, jest.fn());
    expect(req1.headers[REQUEST_ID_HEADER]).not.toBe(req2.headers[REQUEST_ID_HEADER]);
  });

  it('REQUEST_ID_HEADER constant is lowercase "x-request-id"', () => {
    // HTTP header name must be lowercase for Node.js http module compatibility
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });
});
