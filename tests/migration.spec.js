const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, clearStorage } = require('./helpers');

const LEGACY_SETTINGS = {
  proxyUrl: 'https://api.mistral.ai/v1/chat/completions',
  fetchUrl: '',
  apiKey: 'sk-legacy',
  injectedKey: false,
  modelName: 'mistral-small-latest',
  useMaxTurns: true,
  maxTurns: 5,
  currentPersona: 'general',
  customSystemPrompt: '',
};

const LEGACY_CHAT = {
  id: 'chat_legacy_1',
  title: 'Legacy Chat',
  persona: 'general',
  systemPrompt: 'You are a helpful assistant.',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'hello from before the rename' },
  ],
  turnCount: 1,
};

async function seedLegacyKeys(page, { settings = LEGACY_SETTINGS, chats = [LEGACY_CHAT], currentId = LEGACY_CHAT.id, turnsMigrated = true } = {}) {
  await page.addInitScript((d) => {
    localStorage.setItem('opencode_settings', JSON.stringify(d.settings));
    localStorage.setItem('opencode_chats', JSON.stringify(d.chats));
    localStorage.setItem('opencode_current_chat_id', d.currentId);
    if (d.turnsMigrated) localStorage.setItem('opencode_settings_turns_migrated', 'true');
  }, { settings, chats, currentId, turnsMigrated });
}

test.describe('opencode_* to airgap_* key migration', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await clearStorage(page);
  });

  test('migrates legacy keys, removes originals, preserves chats', async ({ page }) => {
    await seedLegacyKeys(page);
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(() => ({
      newSettings: localStorage.getItem('airgap_settings'),
      newChats: localStorage.getItem('airgap_chats'),
      newCurrent: localStorage.getItem('airgap_current_chat_id'),
      oldSettings: localStorage.getItem('opencode_settings'),
      oldChats: localStorage.getItem('opencode_chats'),
      oldCurrent: localStorage.getItem('opencode_current_chat_id'),
      done: localStorage.getItem('airgap_key_migration_done'),
      loadedId: typeof currentChatId !== 'undefined' ? currentChatId : null,
      loadedCount: typeof chats !== 'undefined' ? chats.length : -1,
    }));

    expect(r.done).toBe('true');
    expect(r.oldSettings).toBeNull();
    expect(r.oldChats).toBeNull();
    expect(r.oldCurrent).toBeNull();
    expect(JSON.parse(r.newSettings).apiKey).toBe('sk-legacy');
    expect(JSON.parse(r.newChats)[0].messages[1].content).toBe('hello from before the rename');
    expect(r.newCurrent).toBe('chat_legacy_1');
    expect(r.loadedId).toBe('chat_legacy_1');
    expect(r.loadedCount).toBe(1);
  });

  test('never overwrites existing airgap_* keys, still clears legacy copies', async ({ page }) => {
    await seedLegacyKeys(page);
    await page.addInitScript(() => {
      localStorage.setItem('airgap_settings', JSON.stringify({ apiKey: 'sk-new', useMaxTurns: false }));
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(() => ({
      apiKey: JSON.parse(localStorage.getItem('airgap_settings')).apiKey,
      oldSettings: localStorage.getItem('opencode_settings'),
    }));

    expect(r.apiKey).toBe('sk-new');
    expect(r.oldSettings).toBeNull();
  });

  test('carries over the turns-migration flag so init does not reset useMaxTurns', async ({ page }) => {
    await seedLegacyKeys(page, { turnsMigrated: true });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(() => ({
      flag: localStorage.getItem('airgap_settings_turns_migrated'),
      useMaxTurns: settings.useMaxTurns,
    }));

    expect(r.flag).toBe('true');
    expect(r.useMaxTurns).toBe(true);
  });

  test('fresh user with no legacy keys boots cleanly and sets the flag', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(() => ({
      done: localStorage.getItem('airgap_key_migration_done'),
      chats: typeof chats !== 'undefined' ? chats.length : -1,
    }));

    expect(r.done).toBe('true');
    expect(r.chats).toBeGreaterThanOrEqual(1);
  });
});
