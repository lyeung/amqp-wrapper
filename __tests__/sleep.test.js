const { sleep } = require('../sleep');

const THREE_SEC = 3;
const ONE_SEC_IN_MS = 1000;
const THREE_SEC_IN_MS = 3000;
const TOLERANCE = 10;

describe('sleep', () => {
  const testSleep = async (secInMillis, sleepFn) => {
    const start = Date.now();
    await sleepFn();
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(secInMillis);
    expect(end - start).toBeLessThan(secInMillis + TOLERANCE);
  };

  test('default as 1 sec', async () => {
    await testSleep(ONE_SEC_IN_MS, () => sleep());
  });

  test('sleep 3 sec', async () => {
    await testSleep(THREE_SEC_IN_MS, () => sleep(THREE_SEC));
  });
});
