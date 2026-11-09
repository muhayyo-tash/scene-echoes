import { expect, test } from '@playwright/test';

test('lab tabs run without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/lab.html');
  for (const name of ['Conversion', '3D Object', 'Book', 'Movie', 'Hotspot picker']) {
    await page.getByRole('button', { name }).click();
    await page.waitForTimeout(200);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
