#!/usr/bin/env node
// One-off migration from the old single-user data.json store to the real
// database, run via `npm run migrate-legacy-data`.
//
// Migration decision (documented, not silently discarded):
//   - `data.json` had no concept of a user — `progress` and `stats` were
//     global, written by whoever happened to be using the app locally.
//     There is no correct owner to assign that history to, so it is NOT
//     copied into the new per-user `progress` / `user_stats` tables. Bringing
//     over made-up ownership would be worse than leaving it out.
//   - The lesson catalog (`lessons` + their `questions`), however, is real
//     content with no user attached, so it IS safe and worth carrying over
//     verbatim rather than re-typing it. That's what this script does.
//   - The `server/db/seeds/01_lessons.js` seed already contains this same
//     content (plus the new lessons for this phase), so on a fresh install
//     you don't need this script at all — it exists only for a deployment
//     that already has a populated data.json it wants to preserve exactly,
//     and it skips any lesson whose title already exists in the database.
const fs = require('fs');
const path = require('path');
const knex = require('../server/db/knex');

const DATA_PATH = path.join(__dirname, '..', 'data.json');

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.log('No data.json found — nothing to migrate.');
    await knex.destroy();
    return;
  }

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const lessons = raw.lessons || [];

  let migrated = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    const existing = await knex('lessons').where({ title: lesson.title }).first();
    if (existing) {
      skipped += 1;
      continue;
    }

    await knex.transaction(async (trx) => {
      const [{ id: lessonId }] = await trx('lessons')
        .insert({
          title: lesson.title,
          category: lesson.category,
          summary: lesson.summary,
          xp_reward: lesson.xp_reward,
        })
        .returning('id');

      await trx('questions').insert(
        (lesson.questions || []).map((q, qi) => ({
          lesson_id: lessonId,
          prompt: q.prompt,
          options: JSON.stringify(q.options),
          correct_index: q.correct_index,
          sort_order: qi,
        })),
      );
    });
    migrated += 1;
  }

  console.log(`Migrated ${migrated} lesson(s) from data.json, skipped ${skipped} already present.`);
  console.log('Note: legacy progress/stats were intentionally NOT migrated — see comment at top of this script.');
  await knex.destroy();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
