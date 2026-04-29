# tw-layout-lint diagnostics

Auto-generated from `src/diagnostics.ts`. Do not edit by hand.

Diagnostic codes are stable starting at 0.1.0: never reused, never removed. Codes that no longer fire are marked deprecated rather than removed.

## Shape diagnostics (top-level input)

### `LL_E_INPUT_SHAPE`

- **Severity:** error
- **Status:** active
- **Title:** Input is not a valid LayoutLintInput object
- **Default hint:** Top-level value must be an object with a 'root' field of shape { className: string, style?: Record<`--…`, string> }.

### `LL_E_CLASSNAME_NOT_STRING`

- **Severity:** error
- **Status:** active
- **Title:** className must be a string
- **Default hint:** Set className to a single space-separated string of utility classes.

### `LL_E_STYLE_NOT_OBJECT`

- **Severity:** error
- **Status:** active
- **Title:** style must be a plain object of CSS custom property entries
- **Default hint:** Use { '--ll-cols': '...' }; never an array, function, or null.

### `LL_E_STYLE_VALUE_NOT_STRING`

- **Severity:** error
- **Status:** active
- **Title:** style values must be strings
- **Default hint:** CSS custom property values are strings; numbers and booleans are not accepted.

### `LL_E_REGION_ID`

- **Severity:** error
- **Status:** active
- **Title:** Region id is not a valid identifier
- **Default hint:** Region keys must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/. No empty strings, prototype names, or symbols.

### `LL_W_BUILDTIME_CUSTOM_NAMES`

- **Severity:** warning
- **Status:** active
- **Title:** Custom container names or cssVarPrefix require user-supplied source coverage
- **Default hint:** Build-time mode permits custom names, but the user is responsible for ensuring Tailwind scans or safelists the resulting classes.

### `LL_W_UNKNOWN_FIELD`

- **Severity:** warning
- **Status:** active
- **Title:** Field is not part of the LayoutLintInput schema and was ignored
- **Default hint:** Top-level keys are container/root/regions; target keys are className/style. Any other field is silently dropped — move metadata outside the input or remove the field.

## Parse diagnostics (token grammar)

### `LL_E_PARSE_TOKEN`

- **Severity:** error
- **Status:** active
- **Title:** Class token does not match the layout grammar
- **Default hint:** Check that the class is one of the allowlisted layout utilities and uses only allowed variants.

### `LL_E_VARIANT_STACK_NOT_ALLOWED`

- **Severity:** error
- **Status:** active
- **Title:** Stacked container variants are not allowed in v0.1
- **Default hint:** Use at most one container variant per class token. e.g. '@max-md/layout:hidden', not '@sm/layout:@max-md/layout:hidden'.

### `LL_E_ARBITRARY_BREAKPOINT`

- **Severity:** error
- **Status:** active
- **Title:** Arbitrary container breakpoints are not allowed in v0.1
- **Default hint:** Use named breakpoints from {3xs,2xs,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}, e.g. '@max-md/layout:'.

### `LL_E_IMPORTANT_NOT_ALLOWED`

- **Severity:** error
- **Status:** active
- **Title:** The !important modifier is not allowed
- **Default hint:** Remove the leading !.

## Allowlist diagnostics (utility / variant / value form)

### `LL_E_UTILITY_NOT_LAYOUT`

- **Severity:** error
- **Status:** active
- **Title:** Utility is not in the layout-only allowlist
- **Default hint:** Layout regions only allow flex/grid/gap/order/min-*/max-* utilities. Visual styling belongs in the host.

### `LL_E_VARIANT_NOT_ALLOWED`

- **Severity:** error
- **Status:** active
- **Title:** Variant prefix is not allowed
- **Default hint:** Only named container variants (@<size>/<name>:, @max-<size>/<name>:) are allowed in layout regions.

### `LL_E_ARBITRARY_VALUE_RUNTIME`

- **Severity:** error
- **Status:** active
- **Title:** Arbitrary value classes are not allowed in runtime mode
- **Default hint:** Move the dynamic value to a CSS variable: e.g. grid-cols-(--ll-cols) with style: { '--ll-cols': '...' }.

### `LL_E_NUMERIC_UTILITY_RUNTIME`

- **Severity:** error
- **Status:** active
- **Title:** Static numeric utility is not allowed in runtime mode
- **Default hint:** Use a CSS-variable form (e.g. grid-cols-(--ll-cols)) instead. The exceptions are 'grid-cols-1' and 'grid-rows-1' under a container variant for responsive collapse.

### `LL_E_RUNTIME_VAR_NAME`

- **Severity:** error
- **Status:** active
- **Title:** CSS variable name is not in the runtime canonical set
- **Default hint:** Runtime mode accepts only canonical variable names: --ll-cols, --ll-rows, --ll-gap, --ll-gap-x, --ll-gap-y, --ll-basis, --ll-min-w, --ll-min-h, --ll-max-w, --ll-max-h, --ll-order. For custom names, use build-time mode.

### `LL_E_VARIANT_TARGET_RUNTIME`

- **Severity:** error
- **Status:** active
- **Title:** Variant + utility combination is not in the runtime safelist
- **Default hint:** In runtime mode, container variants are allowed only on a finite set: hidden, block, flex, grid, flex-row, flex-col, grid-cols-1, grid-rows-1, grid-cols-(--ll-cols), grid-rows-(--ll-rows).

### `LL_E_RUNTIME_FAMILY_VAR_PAIR`

- **Severity:** error
- **Status:** active
- **Title:** CSS variable does not match the utility family
- **Default hint:** Runtime mode pairs each family with its own canonical variable: grid-cols/(--ll-cols), grid-rows/(--ll-rows), gap/(--ll-gap), gap-x/(--ll-gap-x), gap-y/(--ll-gap-y), basis/(--ll-basis), min-w/(--ll-min-w), min-h/(--ll-min-h), max-w/(--ll-max-w), max-h/(--ll-max-h), order/(--ll-order). 'col-span' and 'row-span' have no CSS-variable form in runtime mode — use a static span or build-time mode.

### `LL_W_ROOT_HIDDEN`

- **Severity:** warning
- **Status:** active
- **Title:** Unprefixed 'hidden' on container or root erases content at all sizes
- **Default hint:** Move hidden under a container variant (e.g. @max-md/layout:hidden) or remove it.

### `LL_W_CONTENTS_DISPLAY`

- **Severity:** warning
- **Status:** active
- **Title:** display: contents on container or root has accessibility edge cases
- **Default hint:** Prefer a normal display unless contents is specifically required.

### `LL_W_ORDER_A11Y`

- **Severity:** warning
- **Status:** active
- **Title:** Custom order can diverge from DOM/focus order
- **Default hint:** Verify keyboard navigation order matches the visual order.

### `LL_W_CONFLICTING_UTILITY`

- **Severity:** warning
- **Status:** active
- **Title:** Multiple utilities from the same family target the same CSS property
- **Default hint:** Two or more utilities target the same CSS property at the same variant scope (e.g. 'grid flex' or 'flex-row flex-col'). The browser picks one based on source order; the result is unpredictable. Use only one utility per family per scope.

## Reachability diagnostics (CSS-var ↔ utility)

### `LL_E_VAR_OUT_OF_NAMESPACE`

- **Severity:** error
- **Status:** active
- **Title:** CSS variable is outside the configured namespace
- **Default hint:** Use the configured cssVarPrefix (default '--ll-') for every layout-controlled variable.

### `LL_E_VAR_DANGLING_REF`

- **Severity:** error
- **Status:** active
- **Title:** Utility references a CSS variable with no matching style entry
- **Default hint:** Add the referenced variable to style on the same target, or remove the utility.

### `LL_E_VAR_VALUE`

- **Severity:** error
- **Status:** active
- **Title:** CSS variable value does not match the consuming utility's grammar
- **Default hint:** Check the value against the expected CSS form (grid-template tracks, length, integer).

### `LL_W_UNUSED_VAR`

- **Severity:** warning
- **Status:** active
- **Title:** CSS variable is declared but not referenced by any utility on this target
- **Default hint:** Remove the variable, or add a utility that consumes it.

## Invariant diagnostics (structural rules)

### `LL_E_CONTAINER_MISSING`

- **Severity:** error
- **Status:** active
- **Title:** Container query variant requires an explicit container target
- **Default hint:** Add input.container with className containing @container/<name> matching the variant's name.

### `LL_E_CONTAINER_PLACEMENT`

- **Severity:** error
- **Status:** active
- **Title:** @container/<name> must appear only on input.container.className
- **Default hint:** Move @container/<name> to input.container.className. Root and regions must not declare a container.

### `LL_E_CONTAINER_VARIANT_PLACEMENT`

- **Severity:** error
- **Status:** active
- **Title:** Container-query variants are not allowed on input.container.className
- **Default hint:** Container variants belong on root.className or regions[*].className, not on the container itself.
