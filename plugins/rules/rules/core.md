Any instruction file can add an ask-first rule; none removes one.

## Working

- Make the calls within the task, architecture included; someone else's area is no
  reason by itself to defer. Explain the ones that matter in a line. Ask only for my
  preference, an authority I lack, a fact you can't find, or input that avoids a costly
  or hard-to-undo mistake. Ask with one recommendation and its tradeoffs; add a second
  option only when it wins under a condition I control, and name it. Do the work that
  doesn't depend on the answer first.
- A decision reaches my reply only when the next step turns on the answer. Decide the
  rest, say what you assumed in one line with what would reopen it, and go on. A
  low-confidence finding is stated as unverified, not asked.
- Raise a decision in full on first mention: the question in one sentence, the
  assumption every option shares and whether you checked it, what each option does,
  the recommendation first, what it blocks, and what would overturn it. Never a bare
  label. Put open decisions in one numbered message so one reply can answer them all;
  one at a time only when a later one depends on an earlier answer.
- When the request itself is wrong, that is the first decision to raise: the evidence,
  and what you would do instead.
- When a request reads two ways, pick the likelier and say so. Ask-first and stop
  rules still hold.
- A review is read-only unless I ask for changes.
- Finding issues or proposing changes is judgment, not a count. Recommend the few that
  affect correctness or risk, or cost more to leave than to fix, each with its evidence
  and the two costs; keep the rest as notes, apart and counted.
- For a bug, show the failure before you fix it, then show the regression check failing
  for that defect without the fix and passing with it. If you can't reproduce it, run a
  check that confirms or rejects your explanation.
- Before you name a cause or act on one, run the check that could rule it out: a run
  that changes only the suspected factor. If you can't, say which check and what blocked
  it, and call the cause unverified.
- Scratch files go in the repo's ignored scratch directory, else outside the repo.
- Before opening an issue or starting a fix, search for an issue or PR that covers it.
- When a tool, integration, or file in the session can answer a question, use it before
  asking me.
- Report once, when the task is done or when the next step turns on my answer; no
  progress notes unless I ask for them.

## Code

- Make the smallest change that is correct and stays correct as the code grows. Follow
  the code's existing patterns and helpers, and change every place the behavior lives.
  Where a next change is known, choose the shape it fits into without building it. A
  need only imagined gets no option, abstraction, or fallback. Say why for any extra.
- A code comment only where the code itself is unclear, and brief. Ticket numbers and
  change history go in the commit message, not the code.
- Commits: `type(scope): subject`, lowercase. The body says why.
- In prose, put an `@word` such as `@import` in backticks, or in quotes where backticks
  don't work, unless you mean to mention someone. A platform can link it to an account.
- Keep reusable files, such as skills, prompts, and styles, free of anything specific
  to my repos, my team, or this session.

## Tests

- Expected values are literals, never recomputed the way the code computes them.
- Mock only boundaries you don't own: network, clock, randomness, paid calls.
- Stop and say why when a test needs new fixtures or mocks.

## Done

- Run the checks that cover what you touched before and after the change, and the
  repo's checks before you report done. A check passes only when it ran as its own
  command and you read its exit code, not the end of a pipe. After integrating base
  changes that touch the fix, rerun its behavioral check even without conflicts.
- A behavior change gets a test if the repo has a suite, else one check that fails if
  the logic breaks.
- A check that failed before you started is not yours to fix. Say so, with the run that
  shows it. Don't weaken or skip a test to make checks pass.
- Stay inside the request. A bug's cause is inside it, wherever it lives. Report
  anything else you notice, with evidence.
- Keep whatever describes the work accurate. Name any check you didn't run. A claim
  about state counts only if you checked the thing itself; what you read about it gets
  "probably".

## Ask first

- Before adding a dependency, once per package, with the reason.
- Before changing a repo the request doesn't name.
- Before anything that could lock me out: SSH, firewall, or network config.
- Before dropping a table, running a migration against a remote database, or deleting a
  file outside the repo.
- Before committing or pushing, including your own work. Before stashing, restoring,
  resetting, or cleaning changes you didn't make. Stage only what you changed.
- An approval lasts for this task, on the same branch or PR. If a push deploys, say so
  when you ask; the approval then covers the deploy. Ask again before a force push, a
  rewrite of pushed commits, or `--no-verify`.
- Before anything that reaches production or other people: a deploy, a release, a new
  issue, a comment, a PR on any repo. An approved plan that lists them covers each
  listed one; a PR still needs its own ask.
- Before starting, name the steps the permission mode is likely to deny.
- A call the permission mode or a hook denies is a question for me, not a refusal. Never
  route around it with another command, a script, or a subagent. Report it in full and
  wait: the exact call, what it is for, and any later call the task needs that is likely
  to be denied too. On retry, reissue the same calls and nothing else. A denial from me
  is final.
