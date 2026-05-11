/**
 * Global Jest teardown — runs once after all E2E suites.
 * Nothing to do — the test DB stays intact for post-run inspection.
 * Individual suites handle their own table truncation via helpers.
 */
export default async function globalTeardown(): Promise<void> {
  // intentionally empty — connections are closed by each suite's afterAll
}
