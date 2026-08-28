// Lightweight JSON-file persistence layer.
// Deliberately avoids native-compiled dependencies (e.g. better-sqlite3) so the
// project installs and deploys cleanly on any Node host without a build step.
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.json');

const SEED_LESSONS = [
  {
    id: 1,
    title: 'Reading a Wiring Diagram',
    category: 'Diagnostics',
    summary: 'Learn to trace circuits and spot common wiring faults before they become expensive repairs.',
    xp_reward: 25,
    questions: [
      {
        id: 1,
        prompt: 'On a standard wiring diagram, a broken line typically indicates:',
        options: ['A ground connection', 'An optional or user-installed circuit', 'A blown fuse', 'A relay coil'],
        correct_index: 1,
      },
      {
        id: 2,
        prompt: 'Which symbol usually represents a fuse?',
        options: ['A circle with an X', 'A wavy line', 'A rectangle with a line through it', 'A triangle'],
        correct_index: 2,
      },
    ],
  },
  {
    id: 2,
    title: 'Torque Spec Fundamentals',
    category: 'Service Basics',
    summary: 'Why torque specs matter, and what happens when a fastener is over- or under-torqued.',
    xp_reward: 20,
    questions: [
      {
        id: 3,
        prompt: 'Over-torquing a fastener most commonly leads to:',
        options: ['Improved seal', 'Thread or component damage', 'Lower vibration', 'Faster installation'],
        correct_index: 1,
      },
      {
        id: 4,
        prompt: 'A torque wrench should be stored:',
        options: ['At its maximum setting', 'At its lowest setting after use', 'Fully disassembled', 'In direct sunlight'],
        correct_index: 1,
      },
    ],
  },
  {
    id: 3,
    title: 'Customer Communication Basics',
    category: 'Service Advisor',
    summary: 'Turning a diagnostic report into something a customer actually understands and trusts.',
    xp_reward: 15,
    questions: [
      {
        id: 5,
        prompt: 'When explaining a repair to a customer, it is best to:',
        options: ['Use as much technical jargon as possible', 'Explain the problem, the fix, and the value in plain language', 'Avoid giving any explanation', 'Only discuss price'],
        correct_index: 1,
      },
      {
        id: 6,
        prompt: 'Building customer trust is most helped by:',
        options: ['Vague answers', 'Transparency about what was found and why it matters', 'Rushing the conversation', 'Avoiding eye contact'],
        correct_index: 1,
      },
    ],
  },
];

function defaultData() {
  return {
    lessons: SEED_LESSONS,
    progress: [], // { id, lesson_id, completed_at, score, xp_earned }
    stats: { total_xp: 0, current_streak: 0, longest_streak: 0, last_activity_date: null },
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = defaultData();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
