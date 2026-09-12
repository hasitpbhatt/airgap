const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, seedSettings } = require('./helpers');

// First-run onboarding (roadmap M1.4): three questions, each mapped to a real
// setting, always skippable, never shown twice.

async function openFirstRun(page) {
  await mockCdn(page);
  await seedSettings(page, { apiKey: 'sk-test', onboarded: false });
  await page.goto(INDEX);
  await page.waitForSelector('#sidebar');
}

async function pickOption(page, index) {
  await page.locator('.onboarding-option').nth(index).click();
}

test.describe('First-run onboarding', () => {
  test('shows on first run once a key is set', async ({ page }) => {
    await openFirstRun(page);
    await expect(page.locator('#onboarding-overlay')).toBeVisible();
    await expect(page.locator('.onboarding-question')).toHaveText('What best describes you?');
    await expect(page.locator('.onboarding-progress')).toHaveText('Step 1 of 3');
  });

  test('will not advance until a choice is made', async ({ page }) => {
    await openFirstRun(page);
    await expect(page.locator('#onboarding-next')).toBeDisabled();
    await pickOption(page, 0);
    await expect(page.locator('#onboarding-next')).toBeEnabled();
  });

  test('walks three steps and applies every answer to settings', async ({ page }) => {
    await openFirstRun(page);

    await pickOption(page, 1);
    await page.locator('#onboarding-next').click();
    await expect(page.locator('.onboarding-progress')).toHaveText('Step 2 of 3');

    await pickOption(page, 2);
    await page.locator('#onboarding-next').click();
    await expect(page.locator('.onboarding-progress')).toHaveText('Step 3 of 3');

    await pickOption(page, 0);
    await page.locator('#onboarding-next').click();

    await expect(page.locator('#onboarding-overlay')).toBeHidden();
    const r = await page.evaluate(() => ({
      persona: settings.currentPersona,
      proxyUrl: settings.proxyUrl,
      modelName: settings.modelName,
      prompts: settings.starterPrompts,
      flag: localStorage.getItem('airgap_onboarded'),
    }));
    expect(r.persona).toBe('deep');
    expect(r.proxyUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(r.modelName).toBe('llama-3.3-70b-versatile');
    expect(r.prompts).toHaveLength(3);
    expect(r.flag).toBe('1');
  });

  test('skip dismisses without touching settings', async ({ page }) => {
    await openFirstRun(page);
    await page.locator('#onboarding-skip').click();
    await expect(page.locator('#onboarding-overlay')).toBeHidden();
    const r = await page.evaluate(() => ({
      persona: settings.currentPersona,
      proxyUrl: settings.proxyUrl,
      prompts: settings.starterPrompts || null,
      flag: localStorage.getItem('airgap_onboarded'),
    }));
    expect(r.persona).toBe('general');
    expect(r.proxyUrl).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(r.prompts).toBeNull();
    expect(r.flag).toBe('1');
  });

  test('can go back a step without losing the earlier answer', async ({ page }) => {
    await openFirstRun(page);
    await pickOption(page, 2);
    await page.locator('#onboarding-next').click();
    await page.locator('#onboarding-back').click();
    await expect(page.locator('.onboarding-progress')).toHaveText('Step 1 of 3');
    await expect(page.locator('.onboarding-option').nth(2)).toHaveClass(/onboarding-option-selected/);
  });

  test('does not show again once onboarded', async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    await expect(page.locator('#onboarding-overlay')).toBeHidden();
  });

  test('chosen prompts appear as chips and fill the composer', async ({ page }) => {
    await openFirstRun(page);
    await pickOption(page, 0);
    await page.locator('#onboarding-next').click();
    await pickOption(page, 0);
    await page.locator('#onboarding-next').click();
    await pickOption(page, 0);
    await page.locator('#onboarding-next').click();

    const chips = page.locator('.starter-prompt');
    await expect(chips).toHaveCount(3);
    const first = await chips.first().textContent();
    await chips.first().click();
    await expect(page.locator('#chat-textarea')).toHaveValue(first);
  });
});
