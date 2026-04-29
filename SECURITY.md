# Security Policy

## Supported versions

Only the latest minor release is supported. v0.x releases may receive security fixes as patch releases (`0.x.y`); older minors do not.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Instead, open a private security advisory:
https://github.com/bbopen/tw-layout-lint/security/advisories/new

Or email the maintainer at the address listed on the [bbopen GitHub profile](https://github.com/bbopen).

I aim to acknowledge within 72 hours and ship a fix within two weeks for confirmed issues. If you don't get a response in 72 hours, please bump the advisory or follow up via email.

## Threat model

`tw-layout-lint` is a developer / agent tool that runs at validation time. It does not handle credentials, network input, or user-typed text in production. The realistic security concerns are:

- **Injection through CSS-variable values.** The validator already rejects `calc()`, `var()` nesting, `url()`, `clamp()`, `min()`, `max()`, `env()`, semicolons, scientific notation, leading/trailing whitespace, NaN, and Infinity. If you find a value form that bypasses these checks, that's a security bug.
- **Prototype pollution via region IDs.** The validator rejects `__proto__`, `constructor`, and `prototype` as region keys, and the schema only enumerates own properties. Attempts to escape this are in-scope.
- **Supply-chain compromise of the published tarball.** Releases are gated by `scripts/check-consumer.sh` which builds a fresh consumer from the tarball. Reproduce-from-source is the verification path; report any divergence between the tarball and `git checkout v<x.y.z>` as a security issue.

Out of scope:
- The demo project (`examples/demo/`) is a reference app, not a production target.
- Dependent vulnerabilities surfaced by `npm audit` against transitive devDependencies are not considered security issues for this package unless they affect the runtime behavior of consumer code.
