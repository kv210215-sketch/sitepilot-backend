import { AppLoggerService } from './app-logger.service';

describe('AppLoggerService', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env.NODE_ENV;
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.env.NODE_ENV = savedEnv;
    jest.restoreAllMocks();
  });

  // ── Development mode ───────────────────────────────────────────────────

  describe('development mode', () => {
    let logger: AppLoggerService;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      logger = new AppLoggerService();
    });

    it('log() writes to stdout', () => {
      logger.log('hello');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('warn() writes to stdout', () => {
      logger.warn('caution');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('error() writes to stderr (not stdout)', () => {
      logger.error('fail');
      expect(stderrSpy).toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('dev output is plain text, not JSON', () => {
      logger.log('hello');
      const written = stdoutSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(written)).toThrow();
    });

    it('output contains the message text', () => {
      logger.log('my-distinct-message');
      const written = stdoutSpy.mock.calls[0][0] as string;
      expect(written).toContain('my-distinct-message');
    });

    it('output contains the context when provided', () => {
      logger.log('something happened', 'MyContext');
      const written = stdoutSpy.mock.calls[0][0] as string;
      expect(written).toContain('MyContext');
    });
  });

  // ── Production mode ────────────────────────────────────────────────────

  describe('production mode', () => {
    let logger: AppLoggerService;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      logger = new AppLoggerService();
    });

    it('log() writes to stdout', () => {
      logger.log('hello');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('output is a single valid JSON line', () => {
      logger.log('hello world');
      const written = stdoutSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(written)).not.toThrow();
    });

    it('JSON line ends with a newline', () => {
      logger.log('hello');
      const written = stdoutSpy.mock.calls[0][0] as string;
      expect(written.endsWith('\n')).toBe(true);
    });

    it('JSON output has level field set to "log"', () => {
      logger.log('msg');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('log');
    });

    it('JSON output has message, timestamp, pid fields', () => {
      logger.log('test message', 'SomeCtx');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.message).toBe('test message');
      expect(typeof entry.timestamp).toBe('string');
      expect(typeof entry.pid).toBe('number');
    });

    it('JSON output includes context when provided', () => {
      logger.log('msg', 'SomeCtx');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.context).toBe('SomeCtx');
    });

    it('JSON output omits context key when not provided', () => {
      logger.log('msg');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.context).toBeUndefined();
    });

    it('error() sets level to "error"', () => {
      logger.error('fail', undefined, 'Ctx');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('error');
    });

    it('error() includes trace when provided', () => {
      logger.error('fail', 'Error: boom\n  at line 1', 'Ctx');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.trace).toBe('Error: boom\n  at line 1');
    });

    it('error() omits trace key when trace is undefined', () => {
      logger.error('fail');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.trace).toBeUndefined();
    });

    it('warn() sets level to "warn"', () => {
      logger.warn('caution');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('warn');
    });

    it('pid matches the current process', () => {
      logger.log('msg');
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.pid).toBe(process.pid);
    });

    it('serialises non-string messages to JSON', () => {
      logger.log({ code: 42 });
      const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(entry.message).toBe('{"code":42}');
    });
  });
});
