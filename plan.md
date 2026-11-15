# sched-prod incident board — plan

The on-call board for sched-prod. One page, one list: tonight's incidents, newest first, so on-call sees
what just broke and takes it.

## Flows

| flow | who | what happens |
|------|-----|--------------|
| `open-board` | on-call | opens the board; sees tonight's incidents |
| `ack-incident` | on-call | picks Ack on a row, checks the incident ID in a confirmation, then confirms — "I've got this one"; Cancel sends no ack |
| `watch-board` | on-call | keeps the board open; it stays current without a reload |

## Requirements

- **R1** New incidents appear live at the top of the list, newest first.
- **R2** Each incident row has an **Ack** button. Ack opens a confirmation naming that incident's ID and describing it. Only Confirm Ack sends `api.ack(id)` for the named ID and marks the row acked. Cancel and Escape send no ack. The confirmation holds the chosen ID while new incidents keep arriving live at the top.
- **R3** Show a loader until incidents load.
- **R4** The board refreshes itself every 2 seconds while open.
- **R5** Times show in the viewer's local time; day before month for EU locales (dd/mm).
- **R6** The page names its build: `<meta name="build" content="<git sha>">` in the head and the same sha in the footer.

## Hooks (pinned — tests and the replay rely on them)

| `data-testid` | element |
|---------------|---------|
| `board` | the board's main area |
| `loader` | the loader (gone once incidents load) |
| `empty` | what shows when there are no incidents |
| `incident-list` | the list |
| `incident-row` | one incident row, with `data-id="<incident id>"` |
| `ack` | the Ack button in a row |
| `acked` | the acked mark in a row |
| `build-sha` | the sha in the footer |
| `confirm` | confirmation dialog, naming the incident ID |
| `confirm-ack` | confirms the named incident |
| `confirm-cancel` | cancels without acknowledging |

## Product decision — 15 November 2026

Product watched the first recording at 00:11 and decided: new incidents stay live at the top,
and Ack stays on each row, but asks for confirmation naming the incident ID. R1 and the two-second
polling interval remain in force. R2 and ack-incident now include the confirmation above. The API,
incident data, UTC datetime values and viewer-local display are unchanged.

## Done

Every issue in `issues/` delivered, deployed to a public https address, and shown working.
