import { withDialogue } from "./dialogueHelper";

// Robustly normalize a question/follow-up that may be a string or an object
function extractSenderAndText(item) {
  if (!item) return null;

  // Already normalized shape
  if (typeof item === "object") {
    const sender = item.sender || "Interviewer";
    // prefer .text, fall back to .prompt, finally empty string
    const text = (typeof item.text === "string" && item.text) ||
                 (typeof item.prompt === "string" && item.prompt) || "";
    const followUps = Array.isArray(item.followUps)
      ? item.followUps.map(extractSenderAndText).filter(Boolean)
      : [];
    return { sender, text, followUps };
  }

  // Legacy "Sender: text" string
  if (typeof item === "string") {
    const m = item.match(/^([^:]+):\s*(.*)$/);
    const sender = m ? m[1].trim() : "Interviewer";
    const text = m ? m[2].trim() : item.trim();
    return { sender, text, followUps: [] };
  }

  // Unknown type -> skip
  return null;
}

  export const questionBank = [
  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Analytics page slowdown after a small update (peak between classes)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    prompt:
      "Welcome to Georgia Tech SGA's tech team. It's the first-week rush; more students are checking club budgets/events than usual. 20 minutes after a small update shipped, the analytics page became very slow. Other pages look fine. It's worse between classes. No DB schema changes were part of the update. You're on point to help triage and steady things.",
    roles: {
      "data-engineer": [
        {
          prompt:
            "Jordan (Backend Eng): First 60 seconds — name the single check you run to confirm this is DB-bound (not frontend). What do you look for and where?",
          followUps: [
            "Sam (Frontend Eng): In one command, how do you capture a query plan for the slowest analytics query? Tell me the exact command or UI and one red flag you expect.",
            "Maya (Founder): If the plan confirms the bottleneck, what is your 15-minute mitigation before the next class changeover?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): You suspect query vs. rendering. What metric or log separates them in 2 minutes, and what threshold flips your call?",
          followUps: [
            "Evelyn (Treasurer): If this is DB-side, what can we safely show students while you stabilize (e.g., partial data, cached summaries)? State the risk plainly.",
            "Maya (Founder): If you’re wrong, what’s your rollback trigger in plain English?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): A budget table query jumped to ~45s. Which index/plan evidence tells you why, and what’s the safest first tweak?",
          followUps: [
            "Sam (Frontend Eng): Kill the query or let it finish — what criterion decides that, and who do you notify?",
            "Evelyn (Treasurer): While you test, what status do we communicate to students to keep trust?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Indexes didn’t change. Name two non-index causes you’ll test (e.g., parameter sniffing, stats drift) and the evidence for each.",
          followUps: [
            "Maya (Founder): Give me one sentence explaining why this isn’t code ‘being wrong’ but conditions changing.",
            "Senator Lee (Student Gov Rep): Show me one artifact that rules out data corruption (what and where)."
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Load spikes between classes. How do you model that surge in a quick test, and what success/failure signal will you monitor?",
          followUps: [
            "Maya (Founder): Without a full load test rig, what’s your lightweight approximation you can run now?",
            "Evelyn (Treasurer): If you can’t simulate perfectly, what short-term guardrail do you put in place today?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Isolate ETL vs live queries — what do you disable/observe first, and what proves your conclusion?",
          followUps: [
            "Dean Miller (Faculty Advisor): Pick one now: ETL or live. What single metric backs that decision?",
            "Maya (Founder): If your call wastes 30 minutes, what’s your plan to recover that time?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): A materialized view is suspected. How do you validate impact with minimal blast radius?",
          followUps: [
            "Alex (Product Manager): If we disable it, what user-visible effect appears and how do we word the banner?",
            "Maya (Founder): If we keep it but rate-limit, what threshold do you set and why?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): If DB contention is the culprit, what’s your fastest proof (e.g., lock waits, blocked PIDs) and your 15-minute patch?",
          followUps: [
            "Senator Lee (Student Gov Rep): State clearly: contention yes/no, and the evidence.",
            "Evelyn (Treasurer): What’s the risk to budget accuracy while this patch runs?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): You have 15 minutes to steady the system. What do you turn off, cache, or degrade, and what KPI says it worked?",
          followUps: [
            "Maya (Founder): Will your patch likely hold for three hours? If not, what’s Plan B?",
            "Evelyn (Treasurer): Is slightly stale data acceptable? Define ‘slightly’ numerically."
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Prevent a repeat next semester — name one concrete alert (metric + threshold + owner) you’d add now.",
          followUps: [
            "Alex (Product Manager): What test or check enforces that alert in CI/CD or pre-release?",
            "Dean Miller (Faculty Advisor): Cost/benefit in one sentence — why is the spend justified?"
          ]
        }
      ],
      "ml-engineer": [
        {
          prompt:
            "Priya (Data Scientist): First check — what metric distinguishes ML inference time from DB latency on the analytics call path?",
          followUps: [
            "Evelyn (Treasurer): Make the call now: ML or DB. What single number made you decide?",
            "Maya (Founder): With 2 minutes to prove it, which dashboard/chart do you show me?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Separate inference latency vs. pipeline lag — which trace/timer do you inspect and what cutoff is suspicious?",
          followUps: [
            "Alex (Product Manager): Explain the finding in plain English to a non-technical audience.",
            "Maya (Founder): If I force a 30-second answer, what’s your conclusion and risk note?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): A forecast model sits on the analytics path. What micro-experiment tells you if it’s the bottleneck without ripping it out?",
          followUps: [
            "Senator Lee (Student Gov Rep): If it is slow, do you gate it behind a toggle? Why/why not?",
            "Evelyn (Treasurer): If disabled, what insight disappears and how do we justify that publicly?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): OCR preprocessing may be heavy. How do you measure its compute footprint and prove/clear it quickly?",
          followUps: [
            "Maya (Founder): Can you assert this isn’t image-related? What single artifact backs that?",
            "Alex (Product Manager): If you can’t prove it fast, do you temporarily bypass OCR? What user impact appears?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Inference spikes align with class changeovers. What throttle or circuit breaker would you apply and at what threshold?",
          followUps: [
            "Evelyn (Treasurer): Throttle or let it run — what’s the fairness implication and how do you mitigate it?",
            "Maya (Founder): If throttling triggers, how do you communicate degraded ML features in-app?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): If ML features slow dashboards, what’s your safe-disable plan (scope, toggle location, and revert test)?",
          followUps: [
            "Priya (Data Scientist): Students will notice missing graphs — what one-liner do we show in the UI?",
            "Maya (Founder): When do we re-enable and what metric gates that decision?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Rule out accidental double-hits to the DB from ML. What log/trace proves it and how do you run it?",
          followUps: [
            "Alex (Product Manager): Do we need to pause any pipelines to test? Why?",
            "Maya (Founder): If your assumption is wrong, we double downtime — still proceed?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Exonerate ML quickly — which two metrics do you surface and what values would implicate ML instead?",
          followUps: [
            "Evelyn (Treasurer): Give one concrete number that clears ML.",
            "Dean Miller (Faculty Advisor): If I don’t buy it, what’s your alternate evidence?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): You get 15 minutes — which ML knobs (batch size, timeout, cache TTL) do you touch first and why?",
          followUps: [
            "Dean Miller (Faculty Advisor): Why touch ML if DB is the likely culprit? Convince me in one sentence.",
            "Maya (Founder): Can you guarantee no bias if certain ML features are off?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Prevent future ML-related slowdowns — specify one test or gate you’d add and the exact failure condition.",
          followUps: [
            "Alex (Product Manager): No theory — name the tool or code hook.",
            "Maya (Founder): Why not keep ML off permanently on the analytics path?"
          ]
        }
      ],
      "swe": [
        {
          prompt:
            "Sam (Frontend Eng): First step to verify why the analytics UI slowed — which browser/network trace or API timing do you check and what’s a red flag?",
          followUps: [
            "Maya (Founder): Choose now — backend or frontend. What evidence backs it?",
            "Jordan (Backend Eng): If you’re wrong, who else do you pull in and what do they check?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Test if React is over-fetching — name the exact place you instrument and what change proves over-fetching.",
          followUps: [
            "Alex (Product Manager): Is this UI bloat? Give a yes/no and one sentence why.",
            "Sam (Frontend Eng): If yes, what do you disable immediately and what’s the visual impact?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): The analytics API slowed — list the three steps in your debugging sequence and the exit condition for each.",
          followUps: [
            "Evelyn (Treasurer): Should we reroute traffic? Under what condition do you say yes?",
            "Maya (Founder): If you reroute, how do you guarantee data consistency?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Graphs freeze mid-load — what specific signal (promise/state/log) tells you if it’s UI stall vs. slow data?",
          followUps: [
            "Alex (Product Manager): Is the page broken or just slow? Make the call and cite one metric.",
            "Maya (Founder): If broken, rollback; what functionality do we lose and for how long?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Simulate peak traffic quickly — what’s your lightweight approach and which KPI tells you it’s representative?",
          followUps: [
            "Maya (Founder): Do you expect failure in 10 minutes — yes/no and why.",
            "Evelyn (Treasurer): If yes, what preemptive UI change reduces risk while you test?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Caching might be bypassed — what concrete test proves it (header, hit ratio, TTL), and what result is decisive?",
          followUps: [
            "Evelyn (Treasurer): If we are serving stale data, how do we label it in the UI to preserve trust?",
            "Maya (Founder): If it’s stale, what’s your time-boxed public message?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Roll back the frontend update or not — what signal (error rate, p95) and threshold decide within 15 seconds?",
          followUps: [
            "Alex (Product Manager): Make the decision — rollback or wait — and name the trigger that would flip you.",
            "Maya (Founder): If rollback fails, what’s Plan B and the communication line?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): If dashboards query too much raw data, what profiling step proves it and what fast UI mitigation do you attempt?",
          followUps: [
            "Maya (Founder): Hide graphs temporarily — yes/no and why.",
            "Evelyn (Treasurer): If hidden, how do you justify the choice to students?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Emergency patch before next rush — what single change (cache TTL, limit, index hint) and how do you measure success?",
          followUps: [
            "Evelyn (Treasurer): Is this patch safe for budget numbers — state the specific risk if any.",
            "Maya (Founder): Can we tolerate some student frustration for two hours — yes/no and why."
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Long-term guardrail — name one test/tool you add (what, where, failure threshold).",
          followUps: [
            "Alex (Product Manager): No buzzwords — what’s the artifact that proves it runs (CI step, rule, or alert)?",
            "Dean Miller (Faculty Advisor): Why spend on testing instead of reacting next time?"
          ]
        }
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Budget numbers incorrect after batch job
  // ─────────────────────────────────────────────────────────────────────────────
  {
    prompt:
      "Welcome to Georgia Tech SGA’s tech team. Midway through the day, multiple student orgs report that their funding dashboards are showing incorrect balances — some clubs show negative budgets, others show double allocations. This began right after last night’s batch job ran. Event attendance and other pages look normal. The Treasurer is fielding complaints and the Exec Board needs answers. You’re on point to investigate whether this is a data corruption, ETL pipeline, or caching issue — and to restore trust before tonight’s budget committee meeting.",
    roles: {
      "data-engineer": [
        {
          prompt:
            "Jordan (Backend Eng): First step when balances look wrong — what quick query or check tells you if the source of truth changed vs. the view?",
          followUps: [
            "Evelyn (Treasurer): Are allocations safe to act on right now — yes/no and why.",
            "Maya (Founder): If you’re unsure, what do you tell org presidents in two sentences?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Confirm or rule out ETL duplication — what join/aggregation proves it and what number seals the case?",
          followUps: [
            "Alex (Product Manager): Own it — was the pipeline at fault? Make the call and one reason.",
            "Maya (Founder): If yes, how long to patch before the committee meeting, and what’s the fallback if you miss it?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): A club shows a negative balance — what exact trace (API + payload) do you pull first and what finding would clear the UI layer?",
          followUps: [
            "Senator Lee (Student Gov Rep): Should that club pause spending — yes/no and the rationale.",
            "Evelyn (Treasurer): If we say ‘don’t pause,’ what’s the over-spend risk and mitigation?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Roll back bad data without losing legit transactions — what’s your safe rollback plan and the verification step?",
          followUps: [
            "Maya (Founder): Do we attempt rollback tonight — yes/no and criteria.",
            "Alex (Product Manager): If unsafe, what’s your read-only or bannered patch?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Batch jobs are blamed — what artifact proves/disproves it (run log, counts, diff) and what threshold is damning?",
          followUps: [
            "Maya (Founder): Choose one now — batch job vs. DB corruption — and cite one reason.",
            "Evelyn (Treasurer): If your call is wrong, who owns remediation and by when?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Duplicate records exist — describe your safe dedupe approach and the guardrail to prevent deleting legit rows.",
          followUps: [
            "Alex (Product Manager): Delete immediately or risk complaints — what decides?",
            "Maya (Founder): If deletion hurts a few users, what’s your rollback path?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Communicate trust while debugging — what single sentence appears on dashboards right now?",
          followUps: [
            "Evelyn (Treasurer): Can we present reports tonight — yes/no and the caveat if yes.",
            "Maya (Founder): If no, give me the exact public line you’ll use."
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Attendance data looks fine — what inference does that allow about scope and what’s the next test you run?",
          followUps: [
            "Dean Miller (Faculty Advisor): Is this proof it’s financial-only — yes/no and why.",
            "Sam (Frontend Eng): If you’re wrong, how do you recover credibility fast?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Emergency step for the vote — choose freeze/read-only/guardrails and define the exact UI state you’ll ship.",
          followUps: [
            "Maya (Founder): Freeze dashboards or risk errors — choose and one sentence to users.",
            "Evelyn (Treasurer): If frozen, how do we show the essential numbers?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Long-term prevention — name one guardrail (constraint, idempotency key, or diff check) and the failure it blocks.",
          followUps: [
            "Maya (Founder): Give the specific place it lives (job, DB, CI).",
            "Evelyn (Treasurer): Why should we trust this fix next cycle?"
          ]
        }
      ],
      "ml-engineer": [
        {
          prompt:
            "Priya (Data Scientist): Did ML preprocessing touch budget data — what table or event proves contact, and what proves isolation?",
          followUps: [
            "Alex (Product Manager): Give a yes/no on ML being the cause and one number to back it.",
            "Evelyn (Treasurer): If yes, can you patch by tonight — what’s the minimal fix?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Could predictive models double-count — what exact field or join would cause that and how do you verify?",
          followUps: [
            "Evelyn (Treasurer): If forecasts skewed allocations, what’s your stopgap?",
            "Maya (Founder): If you’re wrong, what fallback do we execute?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Prove ML is unrelated — name one metric now that would spike if ML were at fault, and its current value.",
          followUps: [
            "Maya (Founder): Show one artifact that clears ML (trace, feature flag stats).",
            "Dean Miller (Faculty Advisor): If they don’t buy it, what’s your second-line evidence?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): OCR receipts might be noisy — how do you test whether they impacted balances with minimal work?",
          followUps: [
            "Maya (Founder): Do we disable OCR immediately — yes/no and impact statement.",
            "Alex (Product Manager): If off, which feature explicitly breaks?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Senators ask about ML bias — what one-liner shows budget fairness and what measure backs it?",
          followUps: [
            "Senator Lee (Student Gov Rep): Is ML to blame for unequal balances — yes/no and the evidence.",
            "Maya (Founder): If not ML, how do you show fairness tomorrow morning?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Could ML pipelines indirectly corrupt DB — what path would that look like and how do you test isolation?",
          followUps: [
            "Maya (Founder): If possible, do we pause ML jobs — yes/no and why.",
            "Evelyn (Treasurer): If paused, what data disappears and how is it labeled?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Immediate action for tonight — one ML lever you pull (off-path, bypass, cap) and the KPI you watch.",
          followUps: [
            "Evelyn (Treasurer): Do we trust tonight’s numbers — make the call.",
            "Maya (Founder): If ‘no,’ what patch do you ship in the meantime?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Communicate that ML isn’t cooking numbers — what exact UI line do you show and where?",
          followUps: [
            "Maya (Founder): Give me the one-line reassurance verbatim.",
            "Alex (Product Manager): If users still don’t trust it, what’s Plan B?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Prove ML didn’t break budgets in 15 minutes — outline your three-step test and the pass/fail for each.",
          followUps: [
            "Dean Miller (Faculty Advisor): Don’t lecture — list the evidence only.",
            "Maya (Founder): If wrong, do you accept blame — yes/no and next step."
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Prevent ML from touching sensitive funds — name one safeguard (schema, ACL, feature flag) you add today.",
          followUps: [
            "Alex (Product Manager): Give the concrete change (file/service).",
            "Maya (Founder): Why fund this now — one sentence ROI."
          ]
        }
      ],
      "swe": [
        {
          prompt:
            "Sam (Frontend Eng): First step when balances are wrong — which payload/field do you verify and what proves UI vs. data issue?",
          followUps: [
            "Maya (Founder): Is this a frontend bug — yes/no with one reason.",
            "Evelyn (Treasurer): If yes, name the quick fix and what still might be wrong."
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Could cached UI be stale/duplicated — what header or cache stat proves it and what TTL would be suspicious?",
          followUps: [
            "Evelyn (Treasurer): Did caching break trust — yes/no and the evidence.",
            "Alex (Product Manager): If yes, clear cache now — how and what’s the user impact?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Confirm data issue vs. rendering — which cross-check do you run and what output clears the UI?",
          followUps: [
            "Maya (Founder): Cosmetic vs. data bug — choose and justify.",
            "Evelyn (Treasurer): If not cosmetic, who owns the fix and when?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Dashboards show negatives — what UI patch prevents panic (formatting, placeholder, banner) and how do you gate it?",
          followUps: [
            "Maya (Founder): Hide bad numbers or show them — make the call with rationale.",
            "Alex (Product Manager): If hide, what copy do you use to explain it?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Hotfix before vote — safe to ship? What’s the risk and the test you run post-ship?",
          followUps: [
            "Evelyn (Treasurer): Is the risk acceptable right now — yes/no and why.",
            "Maya (Founder): If wrong, our credibility drops — why is it still worth it?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Test if client requests double-count — what trace/log proves it and how fast can you run it?",
          followUps: [
            "Alex (Product Manager): Was this tested pre-release — yes/no and the missing test.",
            "Maya (Founder): If not, why should we trust your code now?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Attendance looks fine — explain how that narrows the bug surface in the UI layer.",
          followUps: [
            "Senator Lee (Student Gov Rep): So only money pages are broken — yes/no with one reason.",
            "Evelyn (Treasurer): Prove it with a single screenshot/log snippet."
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Immediate patch to stabilize tonight — name it, scope it, and the metric that says ‘stable.’",
          followUps: [
            "Maya (Founder): Freeze UI or patch live — choose and one sentence why.",
            "Evelyn (Treasurer): If the patch fails, what’s your backup?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): If rollback is suggested, do you recommend it — criteria and side effects.",
          followUps: [
            "Maya (Founder): Yes/no rollback — give your threshold.",
            "Alex (Product Manager): If rollback hurts other pages, what then?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Long-term guardrail — name one test you’d add and the specific failure it would catch.",
          followUps: [
            "Maya (Founder): Name the artifact (test file, rule, or alert) that proves it exists.",
            "Dean Miller (Faculty Advisor): Why pay for QA instead of winging it?"
          ]
        }
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Login failures / empty dashboards (“lockout”) under peak traffic
  // ─────────────────────────────────────────────────────────────────────────────
  {
    prompt:
      "Welcome to Georgia Tech SGA’s tech team. Just before peak afternoon traffic, students begin reporting login failures when accessing the SGA portal. Some are getting “invalid credentials” even though nothing changed in the auth system. Others log in, but see empty dashboards. The problem appears to spike when traffic is highest (between classes). Faculty advisors and Senators are calling it a “lockout.” You’re on point to triage whether this is an authentication, session management, or scaling issue — and to stabilize access fast, since multiple committee votes depend on the system tonight.",
    roles: {
      "data-engineer": [
        {
          prompt:
            "Jordan (Backend Eng): First check — what metric or log tells you if this is DB connection pressure vs. auth logic failure?",
          followUps: [
            "Maya (Founder): Is this DB-side — yes/no and cite one number.",
            "Evelyn (Treasurer): If you’re wrong, who takes the next action and what do they do?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Could connection pooling cause lockouts — what evidence proves saturation and what immediate lever do you pull?",
          followUps: [
            "Maya (Founder): Are connections currently maxed — yes/no and the exact chart/number.",
            "Alex (Product Manager): If yes, how do you free them before the next surge?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Verify session token issues — what check (TTL/claims/cache) do you run and what outcome points to token corruption?",
          followUps: [
            "Evelyn (Treasurer): So students aren’t hacked — give me the sentence you’d say.",
            "Maya (Founder): If you can’t confirm integrity, do we halt all logins — yes/no and why."
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Distinguish load failure vs. breach — what single metric/alert gives confidence and what is the acceptably safe value?",
          followUps: [
            "Maya (Founder): Give me the number now that supports ‘load, not breach.’",
            "Alex (Product Manager): If you don’t have it, do we roll back auth — yes/no and when?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Patch DB access for the next rush — what short-term change (pool size, timeout) and the KPI you’ll watch?",
          followUps: [
            "Maya (Founder): Will it last three hours — yes/no with reason.",
            "Evelyn (Treasurer): If not, what’s your backup patch?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Could stale cache block valid logins — what purge or key invalidation do you try and how do you limit blast radius?",
          followUps: [
            "Evelyn (Treasurer): Safe to clear cache now — yes/no and why.",
            "Maya (Founder): If dashboards break after purge, what then?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): 500 students locked out at changeover — what is your immediate action (toggle/queue/backoff) and your success criterion?",
          followUps: [
            "Maya (Founder): Freeze logins or risk meltdown — decide and justify.",
            "Evelyn (Treasurer): If freeze, how do we message students in real-time?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Empty dashboards post-login — what evidence differentiates data fetch failure from auth/session failure?",
          followUps: [
            "Senator Lee (Student Gov Rep): 30 seconds — which is it and why.",
            "Maya (Founder): If wrong, do you take the heat in the exec debrief — yes/no."
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Reassure execs it isn’t data corruption — show one proof (snapshot, checksum, query) and where it lives.",
          followUps: [
            "Maya (Founder): Give me the artifact right now.",
            "Dean Miller (Faculty Advisor): If proof fails, how do you recover credibility?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Guard long-term — give one concrete safeguard (rate limits, backoff, circuit) and when it fires.",
          followUps: [
            "Alex (Product Manager): No buzzwords — describe the config or code point.",
            "Dean Miller (Faculty Advisor): Why spend on this if lockouts are rare?"
          ]
        }
      ],
      "ml-engineer": [
        {
          prompt:
            "Priya (Data Scientist): Could ML services touch login flow — show me the path if yes, and one artifact proving it’s off-path if no.",
          followUps: [
            "Maya (Founder): Is ML causing this — yes/no with a single reason.",
            "Evelyn (Treasurer): If not ML, how do you clear suspicion quickly?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): A model scoring call might block auth — what trace proves or disproves that and what timeout do you enforce?",
          followUps: [
            "Maya (Founder): Are model checks slowing students — answer plainly.",
            "Alex (Product Manager): If yes, do you bypass models now — what breaks?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Prove ML is off the login path — what log/diagram diff do you show and who owns it?",
          followUps: [
            "Evelyn (Treasurer): Evidence ML doesn’t touch auth — name it.",
            "Maya (Founder): If you can’t show it, do we disable ML features — yes/no."
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Confirm inference isn’t spiking with logins — which two metrics must diverge if ML were the cause?",
          followUps: [
            "Maya (Founder): Show one chart that proves they’re decoupled.",
            "Dean Miller (Faculty Advisor): If you can’t, we assume coupling — accept that?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Could ML cache keys expire and hide dashboards — what test proves that in 10 minutes?",
          followUps: [
            "Maya (Founder): Is this a session cache bug — yes/no and one clue.",
            "Alex (Product Manager): If yes, can you fix in 30 minutes — what’s the change?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Emergency ML action for tonight — toggle, cap, or bypass — which and what metric tells you to revert?",
          followUps: [
            "Maya (Founder): Disable models across the board — yes/no with user impact.",
            "Evelyn (Treasurer): If disabled, what functionality disappears?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Senators ask about ML bias locking people out — how do you answer and what stat supports it?",
          followUps: [
            "Senator Lee (Student Gov Rep): Is ML biasing access — yes/no and the evidence.",
            "Maya (Founder): If not, what’s your one-line proof?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Empty dashboards — could ML mislabel roles — where do you check the mapping and what indicates a mismatch?",
          followUps: [
            "Alex (Product Manager): Show a data flow that clears ML of role handling.",
            "Maya (Founder): If you can’t, do we rollback ML pipelines — yes/no."
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): 15-minute isolation plan — list steps to separate ML impact from auth, with a pass/fail for each step.",
          followUps: [
            "Evelyn (Treasurer): Do we block ML requests now — yes/no and why.",
            "Maya (Founder): If yes, how do you avoid data science complaints?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Long-term — firewall ML from critical login flows — name the safeguard and its trigger.",
          followUps: [
            "Alex (Product Manager): Give one architectural change you can ship this week.",
            "Dean Miller (Faculty Advisor): Why spend budget if lockouts are rare?"
          ]
        }
      ],
      "swe": [
        {
          prompt:
            "Sam (Frontend Eng): First step on login failures + empty dashboards — which UI/network signal do you inspect and what’s a red flag?",
          followUps: [
            "Maya (Founder): Frontend or backend — pick one and cite one clue.",
            "Jordan (Backend Eng): If wrong, who acts next and how?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Could UI misreport valid credentials — what repro proves the error message is misleading?",
          followUps: [
            "Alex (Product Manager): So it’s a bad error message — yes/no with evidence.",
            "Maya (Founder): If yes, do we hotfix in 15 minutes — yes/no and risk."
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Logged in but empty dashboards — what do you check first (route/permissions/payload) and what finding points to data fetch bug?",
          followUps: [
            "Evelyn (Treasurer): Is it a fetch bug — answer and one proof.",
            "Maya (Founder): If yes, what’s the patch timeline?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Test if session management broke in React — where do you instrument and what result proves it?",
          followUps: [
            "Alex (Product Manager): Was this tested pre-release — yes/no and missing coverage.",
            "Maya (Founder): If not, why trust your build now?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): API routes after update — what quick cross-check confirms misconfig and the fast fix?",
          followUps: [
            "Maya (Founder): Are APIs broken — yes/no with one signal.",
            "Jordan (Backend Eng): If yes, rollback routes or patch — which and why?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Confirm caching isn’t serving wrong login state — what precise check do you run and the deciding outcome?",
          followUps: [
            "Evelyn (Treasurer): Are students being served stale tokens — decide and prove.",
            "Maya (Founder): If yes, is it safe to purge cache mid-day — state your rule."
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Roll back the frontend build — what metric threshold triggers rollback and what is the re-enable rule?",
          followUps: [
            "Maya (Founder): Decide now — rollback or not — and what flips you later.",
            "Alex (Product Manager): If rollback breaks other pages, how do you justify it?"
          ]
        },
        {
          prompt:
            "Priya (Data Scientist): Immediate patch to stabilize access — name it and the KPI that must improve within 10 minutes.",
          followUps: [
            "Maya (Founder): Safe enough for tonight’s sessions — yes/no and why.",
            "Evelyn (Treasurer): If unsafe, what’s the public message about the lockout?"
          ]
        },
        {
          prompt:
            "Jordan (Backend Eng): Senators demand access now — do you whitelist them — criteria and fairness tradeoff.",
          followUps: [
            "Evelyn (Treasurer): Is it fair to prioritize senators — decide and defend.",
            "Maya (Founder): If yes, how do you explain favoritism?"
          ]
        },
        {
          prompt:
            "Sam (Frontend Eng): Long-term resilient login flows — name one safeguard (retry/backoff/feature flag) and when it triggers.",
          followUps: [
            "Alex (Product Manager): Give a concrete config or code point.",
            "Dean Miller (Faculty Advisor): Why fund auth resiliency if incidents are rare?"
          ]
        }
      ]
    }
  }
];


// Turn scenarios -> [{ channel?, prompt, roles: {roleKey: [{sender,text,followUps}] } }]
export function extractBankFrom(bank) {
  return (bank || []).map((scenario) => {
    const prompt = (scenario && (scenario.prompt || scenario.system || "")) || "";
    const channel = scenario?.channel;
    const roles = {};

    // Each role is an array of items (strings or objects)
    for (const [roleKey, arr] of Object.entries(scenario.roles || {})) {
      const normalized = (arr || [])
        .map(extractSenderAndText)   // <- safe for strings/objects/undefined
        .filter(Boolean);            // drop nulls
      roles[roleKey] = normalized;
    }

    return { prompt, channel, roles };
  });
}


// --- Soft-skills scenario bank for #realtime-interference ---

export const realtimeInterf_S1 = {
 channel: "realtime-inference"
,
  prompt:
    "A public thread got heated. Priya (Data Scientist) wants to keep a feature with a heavier model; Jordan (Backend Eng) argues SLO risk and is pushing rollback. Maya (Founder) asks you to cool things down and land a plan in 10 minutes.",
  roles: {
    swe: [
      { sender: "Maya (Founder)", text: "Open neutral: what’s your one line to lower the temperature without taking sides?" },
      { sender: "Priya (Data Scientist)", text: "Reflect back each side in one sentence — what did you hear from Priya vs Jordan?" },
      { sender: "Jordan (Backend Eng)", text: "Set ground rules for the next 5 minutes so we don’t talk past each other." },
      { sender: "Maya (Founder)", text: "Name 3 objective signals we should check to anchor the debate.", followUps: [
        { sender: "Maya (Founder)", text: "Where exactly would you get those (tool/command)?" }
      ]},
      { sender: "Priya (Data Scientist)", text: "Offer Option A vs Option B that respect both aims.", followUps: [
        { sender: "Jordan (Backend Eng)", text: "For each, what’s the cap/guardrail to limit risk?" }
      ]},
      { sender: "Maya (Founder)", text: "Pick one for the next 60 minutes and explain why." },
      { sender: "Jordan (Backend Eng)", text: "Write a ‘disagree-and-commit’ line to unify the team." },
      { sender: "Priya (Data Scientist)", text: "Assign owners & times for the next 15 minutes." },
      { sender: "Maya (Founder)", text: "Draft the short public update for #incidents-war-room." }
    ],
    "data-engineer": [
      { sender: "Maya (Founder)", text: "Lower the heat with a neutral opener — write it." },
      { sender: "Jordan (Backend Eng)", text: "Summarize Jordan’s constraint and Priya’s aim in plain language." },
      { sender: "Priya (Data Scientist)", text: "Propose a 5-minute agenda to reach a decision." },
      { sender: "Maya (Founder)", text: "2 data signals + 2 infra signals you’d check now.", followUps: [
        { sender: "Maya (Founder)", text: "Name the exact place/command for each." }
      ]},
      { sender: "Jordan (Backend Eng)", text: "Suggest a smallest safe slice to test without risking main traffic." },
      { sender: "Priya (Data Scientist)", text: "What do you need from DS to make that slice informative?" },
      { sender: "Maya (Founder)", text: "Phrase the decision so both sides feel respected." },
      { sender: "Jordan (Backend Eng)", text: "Tasks & owners for toggle, guardrails, monitoring (next 30m)." },
      { sender: "Priya (Data Scientist)", text: "Two-sentence status for leadership." }
    ],
    "ml-engineer": [
      { sender: "Maya (Founder)", text: "Acknowledge emotion without taking sides — write that one sentence." },
      { sender: "Priya (Data Scientist)", text: "Reframe into a joint question we can answer in 10 minutes." },
      { sender: "Jordan (Backend Eng)", text: "List 3 constraints (latency, cost, reliability) and 3 measures to watch." },
      { sender: "Maya (Founder)", text: "Offer (A) rollback + instrumented trial vs (B) keep with guardrails.", followUps: [
        { sender: "Maya (Founder)", text: "For each, define the kill switch and who can pull it." }
      ]},
      { sender: "Priya (Data Scientist)", text: "Pick one path and justify briefly." },
      { sender: "Jordan (Backend Eng)", text: "Write a 15-minute checklist with owners." },
      { sender: "Maya (Founder)", text: "Compose the calming public message that sets expectations." },
      { sender: "Priya (Data Scientist)", text: "If pushback persists, your 1-sentence ‘disagree & commit’ reply?" },
      { sender: "Maya (Founder)", text: "One retro tweak to avoid this pattern next time." }
    ]
  }
};

export const realtimeInterf_S2 = {
  channel: "realtime-inference",
  prompt:
    "Support pings are spiking. Priya claims the A/B variant’s uplift justifies the load; Jordan says error budget is burning. Your job: mediate quickly and align on a reversible plan.",
  roles: {
    swe: [
      { sender: "Maya (Founder)", text: "First line to calm the thread and set a constructive tone?" },
      { sender: "Jordan (Backend Eng)", text: "Mirror Jordan’s risk and Priya’s goal in one sentence each." },
      { sender: "Priya (Data Scientist)", text: "What’s the decision framework you’ll use (e.g., safety first, reversible steps)?" },
      { sender: "Maya (Founder)", text: "List the top 3 facts we must verify before we argue further.", followUps: [
        { sender: "Maya (Founder)", text: "Exact commands/queries to fetch them fast?" }
      ]},
      { sender: "Jordan (Backend Eng)", text: "Two options that both cap risk — outline them." },
      { sender: "Priya (Data Scientist)", text: "Pick one and say why, in one paragraph." },
      { sender: "Maya (Founder)", text: "Convert to owners + deadlines (15–30m)." },
      { sender: "Jordan (Backend Eng)", text: "Write the ‘we’re aligned’ line to close the thread." },
      { sender: "Priya (Data Scientist)", text: "Short stakeholder update (2 sentences)." }
    ],
    "data-engineer": [
      { sender: "Maya (Founder)", text: "Neutral opener that validates both sides — write it." },
      { sender: "Priya (Data Scientist)", text: "Propose a narrow measurement plan that satisfies DS + Infra." },
      { sender: "Jordan (Backend Eng)", text: "Define guardrails that make DS’s plan safe." },
      { sender: "Maya (Founder)", text: "Identify 2 data/2 infra metrics to gate keep/rollback.", followUps: [
        { sender: "Maya (Founder)", text: "Where do you pull each metric from?" }
      ]},
      { sender: "Priya (Data Scientist)", text: "Draft the decision in neutral language." },
      { sender: "Jordan (Backend Eng)", text: "Owner list + timing for next checks." },
      { sender: "Maya (Founder)", text: "Escalation path if a metric trips — who calls it?" },
      { sender: "Priya (Data Scientist)", text: "Public note to cool down the channel." },
      { sender: "Maya (Founder)", text: "One retro/process tweak." }
    ],
    "ml-engineer": [
      { sender: "Maya (Founder)", text: "Empathetic one-liner to reduce heat." },
      { sender: "Jordan (Backend Eng)", text: "Translate model vs SLO tension into a single trade-off statement." },
      { sender: "Priya (Data Scientist)", text: "Two variants of guardrails that keep the model but cap risk." },
      { sender: "Maya (Founder)", text: "What 3 measurements define ‘safe enough’ for the next hour?", followUps: [
        { sender: "Maya (Founder)", text: "Who watches which metric?" }
      ]},
      { sender: "Priya (Data Scientist)", text: "Pick a path and define a kill condition." },
      { sender: "Jordan (Backend Eng)", text: "15-minute plan — bullets with owners." },
      { sender: "Maya (Founder)", text: "Close the loop with a calming public message." },
      { sender: "Priya (Data Scientist)", text: "If challenged, your concise disagree-and-commit?" },
      { sender: "Maya (Founder)", text: "Preventative guardrail you’d add post-incident." }
    ]
  }
};

export const realtimeInterf_S3 = {
  channel: "realtime-inference",
  prompt:
    "An experiment is cannibalizing performance during peak. Priya argues the uplift window is brief; Jordan warns of backlogs. You need to mediate, set decision rules, and keep momentum.",
  roles: {
    swe: [
      { sender: "Maya (Founder)", text: "De-escalate with one sentence; keep it neutral." },
      { sender: "Priya (Data Scientist)", text: "State Priya’s need and Jordan’s constraint as you heard them." },
      { sender: "Jordan (Backend Eng)", text: "Propose a 5-min structure to reach a reversible decision." },
      { sender: "Maya (Founder)", text: "Name 3 objective checks to ground the call.", followUps: [
        { sender: "Maya (Founder)", text: "Where do you pull each (tool/command)?" }
      ]},
      { sender: "Priya (Data Scientist)", text: "Offer Option A/Option B; include a kill switch for each." },
      { sender: "Maya (Founder)", text: "Which option now, why, and what’s the first check-in time?" },
      { sender: "Jordan (Backend Eng)", text: "Write the alignment line for the thread." },
      { sender: "Priya (Data Scientist)", text: "Owners & times for the next 15 minutes." },
      { sender: "Maya (Founder)", text: "Public update for stakeholders (2 sentences)." }
    ],
    "data-engineer": [
      { sender: "Maya (Founder)", text: "Open with an empathy line to reduce defensiveness." },
      { sender: "Jordan (Backend Eng)", text: "Translate SLO risk and DS goal into one problem statement." },
      { sender: "Priya (Data Scientist)", text: "Suggest a measurement slice; what would make it decision-worthy?" },
      { sender: "Maya (Founder)", text: "Pick 4 metrics (2 data, 2 infra) that gate decisions.", followUps: [
        { sender: "Maya (Founder)", text: "Name the dashboards/queries you’d use." }
      ]},
      { sender: "Jordan (Backend Eng)", text: "Define guardrails to keep infra safe while testing." },
      { sender: "Priya (Data Scientist)", text: "Write the neutral decision sentence." },
      { sender: "Maya (Founder)", text: "Assign owners; set a review checkpoint." },
      { sender: "Jordan (Backend Eng)", text: "Escalation path if a guardrail trips." },
      { sender: "Priya (Data Scientist)", text: "Short public close-out message." }
    ],
    "ml-engineer": [
      { sender: "Maya (Founder)", text: "Acknowledge both sides in one sentence (no blame)." },
      { sender: "Priya (Data Scientist)", text: "Reframe as a testable hypothesis we can answer fast." },
      { sender: "Jordan (Backend Eng)", text: "Metrics that define ‘safe enough’ for 60 minutes." },
      { sender: "Maya (Founder)", text: "Two options with guardrails + who owns the kill switch.", followUps: [
        { sender: "Maya (Founder)", text: "Which option and why (brief)?" }
      ]},
      { sender: "Priya (Data Scientist)", text: "Checklist (15 min) with owners." },
      { sender: "Jordan (Backend Eng)", text: "Write the thread-calming line you’ll post." },
      { sender: "Maya (Founder)", text: "Set the next checkpoint and success criteria." },
      { sender: "Priya (Data Scientist)", text: "Disagree-and-commit reply if challenged again." },
      { sender: "Maya (Founder)", text: "Retro note to reduce future conflict." }
    ]
  }
};
// collect the soft-skills scenarios for the realtime-interference channel
export const softScenarios = [realtimeInterf_S1, realtimeInterf_S2, realtimeInterf_S3];

