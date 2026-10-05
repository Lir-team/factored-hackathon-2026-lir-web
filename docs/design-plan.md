# Design plan

Written before any markup, following Anthropic's `frontend-design` skill
(Anthropic, Apache-2.0): plan, review against the brief, build, critique.

## Brief

- **Subject:** the support area of LATAM Bank's online banking, the synthetic
  bank behind the Factored AI & Data Hackathon 2026 dataset.
- **Audience:** a signed-in retail customer in Mexico, Colombia or Argentina.
  The most common visitor has just seen a charge they do not recognize, or has
  lost their card. They are worried and in a hurry.
- **Primary job:** file one well-formed support case in under two minutes and
  leave with a case reference. The backend turns that case into a Pub/Sub
  message for the Lir agent.

## Concept: the case slip

Banks speak in paper: statements, vouchers, receipts, folio numbers. The page
is built around a **case slip**, a narrow receipt that sits beside the form and
fills itself in as the customer answers. On submit it receives its folio
(case reference) and timestamp, like a stamped voucher.

That slip is the one bold element. Everything else (top bar, form, statement
rows) stays quiet and disciplined.

The second device comes from the bank statement. For the "I don't recognize
this charge" path, the customer does not type amounts. They pick the charge
from their recent movements, shown as statement rows.

## Tokens

| Name       | Hex       | Role                                              |
|------------|-----------|---------------------------------------------------|
| `ink`      | `#13293D` | Text, wordmark, primary buttons                   |
| `slate`    | `#4E6173` | Secondary text, field hints                       |
| `mist`     | `#E9EEF1` | Page background (cool, not cream)                 |
| `paper`    | `#FFFFFF` | Form surface and the slip                         |
| `marigold` | `#F2A900` | Single accent: selected charge, slip stamp, focus |
| `alert`    | `#B3261E` | Fraud severity, errors                            |

Supporting values: `ok #1E7A4C`, `rule #CBD5DC`.

Marigold (cempasúchil) is a LATAM-native accent and is far from the usual
terracotta and acid-green tells. It never carries body text; on white it is
used as fill or outline with `ink` text on top, which keeps contrast above 7:1.

## Type

- **Bricolage Grotesque** (display, 600–700): headings, the wordmark, the
  folio number on the slip. Slightly condensed and quirky, so it reads as a
  brand rather than a template.
- **Atkinson Hyperlegible Next** (body, 400/700): every label, hint, input and
  amount. It was designed by the Braille Institute for legibility, which suits
  stressed readers and long account numbers. Amounts use `tabular-nums`.

Scale (1.25 ratio, 16 px base): 12.8 / 16 / 20 / 25 / 31.25 / 39. Body line
height 1.5, headings 1.15. Measure capped at 68ch.

## Layout

```
┌───────────────────────────────────────────────────────────────┐
│ LATAM Bank                          ES | PT     Ana Gómez  ▾  │
├───────────────────────────────────────────────────────────────┤
│ Report a problem                                              │
│ Tell us what happened. We will open a case right away.        │
│                                                               │
│ ┌─ form ──────────────────────────────┐   ┌─ case slip ────┐  │
│ │ 1 What happened?                    │   │ LATAM Bank     │  │
│ │   ( ) I don't recognize a charge    │   │ Case slip      │  │
│ │   ( ) My card was lost or stolen    │   │ ...........    │  │
│ │   ...                               │   │ Reason  ...    │  │
│ │ 2 Which charge?                     │   │ Charge  ...    │  │
│ │   ▸ statement rows                  │   │ Amount  ...    │  │
│ │ 3 Details                           │   │ ...........    │  │
│ │ 4 Contact and confirm               │   │ Folio  ——————  │  │
│ │              [ Send report ]        │   └────────────────┘  │
│ └─────────────────────────────────────┘     (sticky)          │
└───────────────────────────────────────────────────────────────┘
```

- Everything is left aligned. The form is a single column of at most 68ch.
- The steps are numbered because they really are a sequence. Steps that do not
  apply to the chosen reason are skipped, and the numbers renumber themselves.
- Below 900 px the slip collapses into a summary bar under the form, above the
  submit button.

## Principles

1. **The charge is the evidence.** Start from the transaction, not from free
   text, so the backend receives the exact `transaction_id` it can verify.
2. **Urgency changes the page.** Picking a fraud reason raises an alert block
   that offers to freeze the card. It is the only alert-red surface on the page.
3. **One accent.** Marigold marks only the current selection, the focus ring
   and the slip stamp.
4. **Plain words.** Sentence case and active voice. The button says "Send
   report" and the confirmation says "Report sent". Errors say what to fix.

## Review against the brief (revisions)

- *First draft:* a dark navy hero with a big balance figure and three stat
  cards. That is the SaaS kit (tell 4) plus the default hero. **Changed** to a
  plain heading over the form, with the slip as the bold element.
- *First draft:* a monospace face for transaction IDs and the folio. That is
  tell 5. **Changed** to Atkinson with tabular figures.
- *First draft:* each step in its own rounded, shadowed card. **Changed** to one
  paper surface whose steps are separated by numbered headings. Only the slip
  gets a distinct shape (a perforated top edge), because it is a different
  object.
- *Dropped accessory:* an animated progress bar above the form. The step
  numbers already carry progress.
