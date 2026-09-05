// Seeds the lesson catalog. Deliberately NOT destructive: lessons/questions
// are referenced by `progress` rows via a cascading foreign key, so wiping
// and re-inserting them on every run would silently delete real users'
// history. Instead this seed only populates the catalog when it's empty
// (fresh install / fresh test DB); changing existing lesson content later is
// a job for a proper migration, not this file.
const LESSONS = [
  {
    title: 'Reading a Wiring Diagram',
    category: 'Diagnostics',
    summary: 'Learn to trace circuits and spot common wiring faults before they become expensive repairs.',
    xp_reward: 25,
    questions: [
      {
        prompt: 'On a standard wiring diagram, a broken line typically indicates:',
        options: ['A ground connection', 'An optional or user-installed circuit', 'A blown fuse', 'A relay coil'],
        correct_index: 1,
      },
      {
        prompt: 'Which symbol usually represents a fuse?',
        options: ['A circle with an X', 'A wavy line', 'A rectangle with a line through it', 'A triangle'],
        correct_index: 2,
      },
    ],
  },
  {
    title: 'Torque Spec Fundamentals',
    category: 'Service Basics',
    summary: 'Why torque specs matter, and what happens when a fastener is over- or under-torqued.',
    xp_reward: 20,
    questions: [
      {
        prompt: 'Over-torquing a fastener most commonly leads to:',
        options: ['Improved seal', 'Thread or component damage', 'Lower vibration', 'Faster installation'],
        correct_index: 1,
      },
      {
        prompt: 'A torque wrench should be stored:',
        options: ['At its maximum setting', 'At its lowest setting after use', 'Fully disassembled', 'In direct sunlight'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Customer Communication Basics',
    category: 'Service Advisor',
    summary: 'Turning a diagnostic report into something a customer actually understands and trusts.',
    xp_reward: 15,
    questions: [
      {
        prompt: 'When explaining a repair to a customer, it is best to:',
        options: ['Use as much technical jargon as possible', 'Explain the problem, the fix, and the value in plain language', 'Avoid giving any explanation', 'Only discuss price'],
        correct_index: 1,
      },
      {
        prompt: 'Building customer trust is most helped by:',
        options: ['Vague answers', 'Transparency about what was found and why it matters', 'Rushing the conversation', 'Avoiding eye contact'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Brake System Basics',
    category: 'Safety',
    summary: 'What actually happens inside a brake system, and the warning signs that separate normal wear from a real problem.',
    xp_reward: 20,
    questions: [
      {
        prompt: 'Brake fluid needs periodic replacement primarily because it:',
        options: ['Evaporates over time', 'Absorbs moisture and degrades, lowering its boiling point', 'Turns solid in cold weather', 'Only needs changing after an accident'],
        correct_index: 1,
      },
      {
        prompt: 'A spongy brake pedal most often indicates:',
        options: ['Air trapped in the brake lines', 'Recently installed pads', 'Freshly bled fluid', 'A properly bled system'],
        correct_index: 0,
      },
    ],
  },
  {
    title: 'Understanding OBD-II Codes',
    category: 'Diagnostics',
    summary: 'What a diagnostic trouble code is actually telling you, and why clearing it isn’t the same as fixing it.',
    xp_reward: 25,
    questions: [
      {
        prompt: "A 'P' prefix on an OBD-II diagnostic trouble code indicates a fault in the:",
        options: ['Body system', 'Chassis system', 'Powertrain system', 'Network communication system'],
        correct_index: 2,
      },
      {
        prompt: 'Clearing a trouble code without fixing the underlying issue will:',
        options: ['Permanently resolve the fault', 'Usually cause the code to return once the condition recurs', 'Void the vehicle’s OBD-II system', 'Improve fuel economy'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Battery and Charging System Checks',
    category: 'Electrical Systems',
    summary: 'Reading a battery correctly and tracking down why one keeps going dead.',
    xp_reward: 20,
    questions: [
      {
        prompt: 'A healthy 12V battery at rest (engine off) should typically read close to:',
        options: ['9.6V', '11.0V', '12.6V', '14.8V'],
        correct_index: 2,
      },
      {
        prompt: 'If a fully charged battery keeps going dead overnight, the most likely cause is:',
        options: ['A parasitic draw somewhere in the electrical system', 'Overinflated tires', 'A clean battery terminal', 'Using the radio during the day'],
        correct_index: 0,
      },
    ],
  },
  {
    title: 'Tire Wear Patterns',
    category: 'Diagnostics',
    summary: 'What the wear pattern on a tire is quietly telling you about inflation and alignment.',
    xp_reward: 20,
    questions: [
      {
        prompt: 'Excessive wear on the outer edges of a tire, with the center still healthy, usually points to:',
        options: ['Overinflation', 'Underinflation', 'A perfectly aligned suspension', 'Brand-new tires'],
        correct_index: 1,
      },
      {
        prompt: 'Wear concentrated only in the center of the tread usually points to:',
        options: ['Underinflation', 'Overinflation', 'A bent wheel', 'Worn shocks'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Shop Safety Fundamentals',
    category: 'Safety',
    summary: 'The habits that keep a shop floor from becoming an accident report.',
    xp_reward: 15,
    questions: [
      {
        prompt: 'Before working under a vehicle raised on a lift, you should always:',
        options: ['Trust the hydraulic lift alone', 'Engage the mechanical safety locks', 'Leave the engine running', 'Remove any wheel chocks'],
        correct_index: 1,
      },
      {
        prompt: 'The correct first step when a chemical splashes in your eyes is to:',
        options: ['Rub your eyes to clear it', 'Flush with water at the eyewash station immediately', 'Wait and see if it stings', 'Apply a bandage'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Fluid Types and Intervals',
    category: 'Service Basics',
    summary: 'Why fluid choice and timing matter more than most customers realize.',
    xp_reward: 20,
    questions: [
      {
        prompt: 'Mixing incompatible types of coolant can:',
        options: ['Improve cooling performance', 'Cause gelling and reduced cooling efficiency', 'Have no effect at all', 'Extend the service interval'],
        correct_index: 1,
      },
      {
        prompt: 'Most conventional engine oil is recommended for replacement roughly every:',
        options: ['1,000 miles', '3,000–5,000 miles', '25,000 miles', 'Only when the engine won’t start'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Reading a Repair Order',
    category: 'Service Advisor',
    summary: 'The repair order is the contract for the job — learn what it protects and who it protects.',
    xp_reward: 15,
    questions: [
      {
        prompt: 'A repair order (RO) primarily exists to:',
        options: ['Replace the need for customer communication', 'Document the customer’s concern and the authorized work and parts/labor', 'Serve as a marketing flyer', 'Track employee lunch breaks'],
        correct_index: 1,
      },
      {
        prompt: 'If a technician finds an additional problem not on the original RO, they should:',
        options: ['Fix it without telling anyone', 'Get customer authorization before performing the extra work', 'Ignore it since it wasn’t requested', 'Charge for it silently'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Basic Hand Tool Care',
    category: 'Tools & Equipment',
    summary: 'Small habits that keep hand tools accurate, safe, and lasting for years.',
    xp_reward: 15,
    questions: [
      {
        prompt: 'Using the wrong size wrench on a fastener most often results in:',
        options: ['Faster loosening', 'Rounded-off fastener corners', 'Improved torque accuracy', 'No difference in outcome'],
        correct_index: 1,
      },
      {
        prompt: 'Corrosion on hand tools is best prevented by:',
        options: ['Storing them wet', 'Leaving them exposed to moisture', 'Keeping them clean and lightly oiled', 'Never using them'],
        correct_index: 2,
      },
    ],
  },
  {
    title: 'Understanding Warranty Claims',
    category: 'Shop Management',
    summary: 'What makes a warranty claim hold up — and what gets it denied.',
    xp_reward: 20,
    questions: [
      {
        prompt: 'A warranty claim is most likely to be denied if:',
        options: ['The required maintenance records are missing', 'The repair matches the covered component', 'The vehicle is within the mileage limit', 'The paperwork is filed correctly'],
        correct_index: 0,
      },
      {
        prompt: 'Keeping detailed service records mainly helps by:',
        options: ['Slowing down the shop', 'Supporting future warranty and diagnostic decisions', 'Having no real benefit', 'Confusing technicians'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Electrical Circuit Fundamentals',
    category: 'Electrical Systems',
    summary: 'The handful of core ideas that make every wiring diagram make sense.',
    xp_reward: 25,
    questions: [
      {
        prompt: 'In a basic series circuit, if one component fails open, the rest of the circuit will:',
        options: ['Continue working normally', 'Also stop working', 'Draw more current', 'Short to ground'],
        correct_index: 1,
      },
      {
        prompt: 'A fuse is designed to:',
        options: ['Increase current flow', 'Protect a circuit by breaking it under excess current', 'Store electrical charge', 'Convert AC to DC'],
        correct_index: 1,
      },
    ],
  },
  {
    title: 'Handling Customer Complaints',
    category: 'Service Advisor',
    summary: 'A frustrated customer is a conversation to steer, not a fire to put out.',
    xp_reward: 15,
    questions: [
      {
        prompt: 'When a customer is upset about a repeat repair, the best first step is to:',
        options: ['Argue that the repair was correct', 'Listen fully before responding', 'Immediately blame the technician', 'Hang up the phone'],
        correct_index: 1,
      },
      {
        prompt: 'De-escalating a frustrated customer is most effectively done by:',
        options: ['Acknowledging their concern and outlining a clear next step', 'Dismissing their concern', 'Talking over them', 'Staying silent and avoiding eye contact'],
        correct_index: 0,
      },
    ],
  },
  {
    title: 'Preventive Maintenance Scheduling',
    category: 'Service Basics',
    summary: 'Why maintenance intervals are built on both mileage and time — not just one or the other.',
    xp_reward: 20,
    questions: [
      {
        prompt: 'Preventive maintenance is primarily meant to:',
        options: ['Catch small issues before they become expensive failures', 'Increase the number of unplanned breakdowns', 'Replace parts that are still in perfect condition, at random', 'Void the manufacturer’s warranty'],
        correct_index: 0,
      },
      {
        prompt: 'A maintenance schedule based on mileage AND time exists because:',
        options: ['Time-based wear (like fluid degradation) happens even with low mileage', 'Mileage never actually matters', 'Time never actually matters', 'Manufacturers want to sell more parts'],
        correct_index: 0,
      },
    ],
  },
];

/** @param {import('knex').Knex} knex */
exports.seed = async function seed(knex) {
  const [{ count }] = await knex('lessons').count('id as count');
  if (Number(count) > 0) {
    console.log(`Skipping lesson seed: ${count} lesson(s) already present.`);
    return;
  }

  await knex.transaction(async (trx) => {
    for (let i = 0; i < LESSONS.length; i += 1) {
      const { questions, ...lesson } = LESSONS[i];
      const [{ id: lessonId }] = await trx('lessons')
        .insert({ ...lesson, sort_order: i })
        .returning('id');

      await trx('questions').insert(
        questions.map((q, qi) => ({
          lesson_id: lessonId,
          prompt: q.prompt,
          options: JSON.stringify(q.options),
          correct_index: q.correct_index,
          sort_order: qi,
        })),
      );
    }
  });

  console.log(`Seeded ${LESSONS.length} lessons.`);
};
