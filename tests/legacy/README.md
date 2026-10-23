# Historical extraction checks

These files describe the pre-React runtime at f67c932 and are retained as audit evidence.
They are not executed as the new behavior contract: search side effects, shared deck/index
folding and duplicated legacy controllers are intentionally replaced. The original
`tests/migration-baseline.json` remains unchanged. Use `tests/react` for current acceptance.
To reproduce the historical suite, check out f67c932 in a separate directory and follow
its README; do not run these files against new runtime expectations.
