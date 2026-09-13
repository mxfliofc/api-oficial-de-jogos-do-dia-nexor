import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const output = resolve('public/games.json');
const timezone = process.env.GAMES_TIMEZONE || 'America/Sao_Paulo';
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const clean = (value) => value?.replace(/\s+/g, ' ').trim() || null;

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: timezone });
  const page = await context.newPage();
  await page.goto('https://www.sofascore.com/pt', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  let unchanged = 0;
  for (let i = 0, total = 0; i < 40 && unchanged < 3; i += 1) {
    const count = await page.locator('[data-testid="eventCell"]').count();
    unchanged = count === total ? unchanged + 1 : 0;
    total = count;
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(250);
  }

  const cards = page.locator('[data-testid="eventCell"]');
  const blocked = await page.locator('text=/captcha|access denied|unusual traffic/i').count();
  if (blocked || await cards.count() === 0) {
    throw new Error('A agenda do Sofascore não foi disponibilizada (bloqueio ou mudança de página). O JSON anterior foi preservado.');
  }

  const rows = await cards.evaluateAll((elements) => elements.map((element) => {
    const text = (selector) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() || null;
    return {
      home: text('[data-testid="eventCellParticipantHomeName"]'),
      away: text('[data-testid="eventCellParticipantAwayName"]'),
      kickoff: text('[data-testid="eventCellStartTime"]'),
      homeScore: text('[data-testid="eventCellHomeScore"]'),
      awayScore: text('[data-testid="eventCellAwayScore"]'),
      href: element.querySelector('a[href*="/football/match/"]')?.getAttribute('href') || null
    };
  }));

  const links = new Set();
  const games = rows.filter((row) => row.home && row.away && row.href)
    .filter((row) => !links.has(row.href) && links.add(row.href))
    .map((row, index) => ({
      id: `sofascore:${row.href.split('/').filter(Boolean).at(-1) || index}`,
      date, kickoff: row.kickoff, timezone, status: 'scheduled',
      home: { name: clean(row.home) }, away: { name: clean(row.away) },
      score: { home: clean(row.homeScore), away: clean(row.awayScore) },
      competition: null, venue: null, broadcasts: [],
      source: { name: 'Sofascore', url: `https://www.sofascore.com${row.href}` }
    }));

  const document = {
    schemaVersion: 2, date, timezone, updatedAt: new Date().toISOString(),
    source: 'Agenda pública renderizada do Sofascore; sem uso de endpoint interno.',
    limitations: ['Competição, estádio e transmissão não constam da agenda pública para todos os jogos.'],
    games
  };
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.tmp`;
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
  await rename(temporary, output);
  console.log(`${games.length} jogos de ${date} gravados em public/games.json`);
} finally {
  await browser.close();
}
