# Examples

- `collect-debtor-list.csv`: a fictional debtor list in the shape a Collect! report saves to a comma-separated file. Dates are dd/mm/yyyy, amounts carry thousands separators. It is synthetic, not an untouched vendor export: you choose the fields when you print the list, so check the headings against your own once.
- `column-map.json`: how to point the import at different headings. Copy it, change the right-hand side to your report's headings, and pass `--map=examples/column-map.json`.

Try it on the demo data:

```bash
node scripts/collections.mjs import collect examples/collect-debtor-list.csv --client=SCB --actor="Your name" --dry-run
```
