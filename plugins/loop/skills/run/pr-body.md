# Publication texts

Read this file from `steps/7-publish.md` when you write a pull request body, a continued pull request comment or a ticket comment.

These texts are published. Name the activity and the date, never a model, an agent type or a tool, and never a run-internal path such as one under `.reimagine/`. Type no attribution trailer. Write a bare `@token` in backticks. Write each section from the record's facts, not from a subagent's claim; check a claim before you repeat it. A section with nothing to say holds the word "none".

## Pull request body

Write the body to the run's body file in the record: `pr-body.md`, or `pr-body-<slug>.md` for an additional repository, each with the suffix `-run<n>` from run 2 on (`record.md`, Files). On a continued branch whose pull request this loop opened, the body covers every input of every run of the record. It has these sections, in this order:

```
## What changed
<per input: the ticket, file or description, "complete" or "partial", what changed, and what is left>
<deferred items: each with its reason>

## Drift corrections
<where a ticket and the code disagreed, and what the change follows>

## Decisions for the reviewer
<design choices; options rejected and why; behavior a reader could take for a bug>
<on a continued branch: this branch carries <n> commits from before the run; they were reviewed as part of this run's diff, and they are listed here>

## Checks not run
<each check not run, with the reason; each check deferred to CI, by job name; each check failing at baseline, with the evidence>

## Related pull requests
<"none" in a single-repository run; "pending" first in a multi-repository run, then the sibling links>

## Closes
<one line per ticket>
```

Closing rules:

- Write `Closes <ref>` only when every acceptance criterion of the ticket is confirmed met. Otherwise write `Refs <ref>`.
- One line per ticket.
- A file input and a text input get no closing line.
- Across repositories only the pull request in the ticket's own repository closes it. Every other pull request cites it as `Refs <owner>/<repo>#<n>`.
- Write an Azure DevOps ticket as `Refs AB#<n>` and a Salesforce ticket as `Refs` and the case number. Neither closes anything.

## Continued pull request comment

Use this when the branch has one open pull request: after the body edit when this loop opened the pull request, and alone when it did not, since a body this loop did not write is never edited. The comment covers this run's work. Write it to `comment-<n>.md`, numbered as `record.md` says, with the sections of the body template above, with `## Closes` replaced by:

```
## Issues
<ref>: complete
<ref>: partial. <what is left>
```

One line per ticket. End the comment with the sentence "The pull request's own body decides what merging it closes."

## Ticket comment

Write one comment for each ticket this run took up to `ticket-<id-slug>.md` (`ticket-<id-slug>-run<n>.md` from run 2 on):

```
Status from the loop run on <branch>: <complete | partial | blocked>

Pull request: <link>
<sibling links, one per line, in a multi-repository run>

Criteria:
- <criterion>: <met | not met | not confirmed>. <evidence>

Not done:
- <item, or "none">

Deferred:
- <item with its reason, or "none">
```

- State "partial" plainly when it is partial.
- Cite evidence for every criterion: a check, a test name, a commit or a line of output.
- Mark a criterion "not confirmed" when you did not see it met yourself.
- Name no run-internal path, no model, no agent and no tool.

Return to the item of `steps/7-publish.md` that sent you here.
