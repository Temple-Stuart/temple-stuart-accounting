/**
 * narrativeCopy — plain-language story text for the public Projects pipe
 * showroom. CONTENT ONLY: a typed module of strings, no React, no data calls.
 * PR9 wires these blocks into ProjectsPipelineShowroom; PR8 only writes them.
 *
 * Voice: short, friendly, 5th-grade. Talks straight to the reader. The strings
 * describe ONLY what the showroom shows on screen — the pretend food-truck books
 * project, its list of small to-dos, its version history, and its links between
 * projects. It does not promise a feature that is not on screen.
 */

export interface CopyBlock {
  heading: string;
  body: string;
}

export interface ShowroomNarrativeCopy {
  /** Top of the pipe — what this is and why it is for you. */
  intro: CopyBlock;
  /** Short labels keyed to the real showroom sections. */
  sections: {
    tasks: CopyBlock;
    evolution: CopyBlock;
    dependencies: CopyBlock;
  };
  /**
   * The AI loop, shown under the reality-input boxes: a plain cause → effect line
   * plus the two (locked) generate-button labels, so a visitor sees
   * "type here → press → here's the plan it built".
   */
  aiLoop: {
    caption: string;
    generatePlanLabel: string;
    generateTasksLabel: string;
  };
  /** Friendly sign-up invite. ctaLabel is the button text (wired in PR9/PR11). */
  closingNudge: {
    body: string;
    ctaLabel: string;
  };
}

export const showroomNarrativeCopy: ShowroomNarrativeCopy = {
  intro: {
    heading: 'Run your whole life in one place',
    body:
      "Yo, check this out. This is the real app, not a screenshot. Click around — " +
      "we loaded a pretend project about getting a food truck's books ready for " +
      'tax time, so you can see how it all feels. Nothing here gets saved. Go ' +
      'ahead, touch everything.',
  },
  sections: {
    tasks: {
      heading: 'Break the big thing into small steps',
      body:
        'A big job feels scary. So you cut it into tiny to-dos you can actually ' +
        'finish. Check them off one at a time and watch your project move.',
    },
    evolution: {
      heading: 'See how your plan grew',
      body:
        'Every time the app rebuilds your task list, it saves that version. ' +
        'Scroll back later and see how your plan changed. Nothing gets lost.',
    },
    dependencies: {
      heading: "Show what's waiting on what",
      body:
        "Some things can't start until other things finish. Link them up, and " +
        "the app keeps the order straight. No more guessing what you're stuck on.",
    },
  },
  aiLoop: {
    caption:
      "Here's the cool part. Type what you know in the boxes up top, tap a " +
      'button, and the app writes your plan and your to-do list for you. The ' +
      'design in step 4 and the version history below? The app made those from ' +
      'your words.',
    generatePlanLabel: '↑ generate plan',
    generateTasksLabel: '↑ generate tasks',
  },
  closingNudge: {
    body:
      'Like what you see? Make a free account and build your own. Your stuff, ' +
      'your way, all in one place.',
    ctaLabel: 'Make my free account',
  },
};
