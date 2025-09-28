// dialogueHelper.js

const dialogueSnippets = {
  urgent: [
    "We’re running out of time here —",
    "Students are already flooding us with complaints —",
    "This system can’t hold much longer —",
    "If we don’t act in the next few minutes, things will spiral —",
    "The exec board is breathing down my neck —"
  ],
  curious: [
    "I’m trying to wrap my head around this —",
    "Something isn’t adding up —",
    "Let me push on this angle —",
    "I want to hear your reasoning on this —",
    "From your perspective, how does this look —"
  ],
  skeptical: [
    "I’m not convinced your last call holds up —",
    "That sounds risky to me —",
    "Are you sure that’s the right move —",
    "If I press you on this, what’s your defense —",
    "Plenty of people here would disagree —"
  ],
  supportive: [
    "Alright, we’re in this together —",
    "Let’s take a step back for a second —",
    "I need your help thinking this through —",
    "Okay, partner, walk me through your call —",
    "Let’s nail this down before it blows up —"
  ],
  strategic: [
    "Think ahead to the next class rush —",
    "What happens if this patch only lasts an hour —",
    "How do we stop this from biting us next semester —",
    "If we fix this now, what’s the long-term cost —",
    "Suppose this same issue crops up at scale —"
  ]
};

// pool for random selection
const allSnippets = Object.values(dialogueSnippets).flat();

// detect if we already prepended one of our snippets
const snippetStartRegex = new RegExp(
  `^(${allSnippets.map(s => escapeRegex(s)).join("|")})\\s*`,
);

// ---------- utils ----------
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRandomSnippet() {
  return allSnippets[Math.floor(Math.random() * allSnippets.length)];
}

function splitSpeakerLine(str) {
  // returns { speaker, text } if "Speaker: rest", else { speaker:null, text:str }
  const m = /^([^:]+):\s*(.*)$/.exec(String(str));
  if (m) return { speaker: m[1].trim(), text: m[2].trim() };
  return { speaker: null, text: String(str).trim() };
}

function prependIfNeeded(text) {
  if (typeof text !== "string" || !text) return text; // guard
  if (snippetStartRegex.test(text)) return text;       // already has a snippet
  return `${getRandomSnippet()} ${text}`;
}

// ---------- core helpers ----------
export function addDialogueToPrompt(promptLike) {
  // Handles:
  //  - string: "Sam: Question?"
  //  - object: { sender, text }  (keeps object shape)
  if (promptLike == null) return promptLike;

  // Object shape
  if (typeof promptLike === "object" && "text" in promptLike) {
    const updated = { ...promptLike };
    updated.text = prependIfNeeded(updated.text);
    return updated;
  }

  // String shape
  if (typeof promptLike === "string") {
    const { speaker, text } = splitSpeakerLine(promptLike);
    const newText = prependIfNeeded(text);
    return speaker ? `${speaker}: ${newText}` : newText;
  }

  // Anything else: return as-is
  return promptLike;
}

export function withDialogue(questionBank) {
  // Supports both your raw questionBank (strings in followUps)
  // and any processed bank with { sender, text } items.
  return questionBank.map(scenario => ({
    ...scenario,
    roles: Object.fromEntries(
      Object.entries(scenario.roles).map(([role, questions]) => [
        role,
        questions.map(q => {
          const next = { ...q };

          // main prompt
          next.prompt = addDialogueToPrompt(next.prompt);

          // followUps: array of strings OR array of { sender, text }
          if (Array.isArray(next.followUps)) {
            next.followUps = next.followUps.map(fu => addDialogueToPrompt(fu));
          }

          return next;
        })
      ])
    )
  }));
}
