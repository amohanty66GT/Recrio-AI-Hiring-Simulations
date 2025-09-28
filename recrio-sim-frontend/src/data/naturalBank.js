import { questionBank, softScenarios, extractBankFrom } from "../components/questionBank";
import { withDialogue } from "../components/dialogueHelper.js";

const combined = [...questionBank, ...softScenarios];
const dialogueReady = withDialogue(combined);

export const naturalExtract = extractBankFrom(dialogueReady);