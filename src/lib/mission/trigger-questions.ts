export interface TriggerQuestionGroup {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    id: string;
    text: string;
  }>;
}

export const TRIGGER_QUESTION_GROUPS: TriggerQuestionGroup[] = [
  {
    id: 'on_fire',
    title: "What's on fire?",
    description: 'Get the urgent stuff out first. What is weighing on you right now.',
    questions: [
      { id: 'on_fire_1', text: "What's broken or blocked that keeps nagging at you?" },
      { id: 'on_fire_2', text: "What have you been putting off that you know you need to deal with?" },
      { id: 'on_fire_3', text: 'What would you fix today if you had zero other obligations?' },
    ],
  },
  {
    id: 'the_work',
    title: "What's the work?",
    description: 'The actual projects and tasks. What needs to get built, shipped, or finished.',
    questions: [
      { id: 'the_work_1', text: 'What are you actively building or shipping right now?' },
      { id: 'the_work_2', text: "What's 80% done but hasn't crossed the finish line?" },
      { id: 'the_work_3', text: 'What would you need to demo to someone to prove your product works?' },
    ],
  },
  {
    id: 'makes_money',
    title: 'What makes money?',
    description: 'Force revenue thinking. Who pays for this and why.',
    questions: [
      { id: 'makes_money_1', text: "If you had to charge someone for something you've built this week, what would it be?" },
      { id: 'makes_money_2', text: "What's standing between you and your first (or next) paying customer?" },
      { id: 'makes_money_3', text: 'What would someone see in a 60-second video that makes them want to buy?' },
    ],
  },
  {
    id: 'unclear',
    title: "What's unclear?",
    description: 'Decisions, unknowns, and research gaps clogging your brain.',
    questions: [
      { id: 'unclear_1', text: "What decision have you been avoiding because you don't have enough information?" },
      { id: 'unclear_2', text: 'What do you need to figure out before you can move forward?' },
      { id: 'unclear_3', text: 'What assumption are you making that might be wrong?' },
    ],
  },
  {
    id: 'real_constraint',
    title: "What's the real constraint?",
    description: 'Hidden blockers — time, money, energy, fear, skill gaps, dependencies.',
    questions: [
      { id: 'real_constraint_1', text: "What can't you do alone that's slowing you down?" },
      { id: 'real_constraint_2', text: 'How many focused hours do you realistically have per day, and what eats the rest?' },
      { id: 'real_constraint_3', text: "What are you afraid won't work even if you execute perfectly?" },
    ],
  },
];

export const OPEN_DUMP_LABEL =
  'Anything else rattling around in your head — ideas, fears, half-thoughts, random observations. No structure needed. Just get it out.';
