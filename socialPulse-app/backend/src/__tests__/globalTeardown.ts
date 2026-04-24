export default async function globalTeardown(): Promise<void> {
    // Pool connections are closed per-test-file in afterAll hooks.
    // Nothing global to tear down.
}
