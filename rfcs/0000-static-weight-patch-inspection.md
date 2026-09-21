# RFC: Opt-in static weight-patch inspection for external execution adapters

- Start Date: 2026-09-22
- Target Major Version: TBD with maintainers
- Reference Issues: [Pre-RFC #46](https://github.com/Comfy-Org/rfcs/issues/46)
- Implementation PR:

## Summary

Discuss a narrowly scoped, explicitly invoked ModelPatcher interface for reading
static weight-patch entries and their version identity without traversing base
checkpoint weights. This draft proposes a borrowed, read-only inspection view,
not an immutable tensor snapshot, serialization format, or worker application API.
Names and the choice of borrowed versus owned data remain open for review.

### Attribution and origin

The motivating integration is based on **buqi-code's
[buqi-minimax-h3-multigpu](https://github.com/buqi-code/buqi-minimax-h3-multigpu)**.
The original Ulysses sequence-parallel implementation, rank0/worker architecture,
sequence partitioning, and core collective/attention implementation are the
original author's work, not inventions of this proposal's submitter.

Our contribution is compatibility adaptation, static LoRA synchronization,
device/lifecycle handling, and regression validation, discussed in
[the author-facing PR #6](https://github.com/buqi-code/buqi-minimax-h3-multigpu/pull/6).
That PR is separate from this RFC. Neither the original author nor ComfyUI
maintainers are represented as endorsing this proposal. Original copyright and
license notices must remain; ComfyUI-derived code is not relicensed as MIT.
This RFC contains no copied Ulysses implementation and proposes no replacement
for the author's algorithm.

## Basic example

Illustrative API only; it does not exist today:

```python
# Caller already owns execution access to this patcher and will not mutate it.
view = patcher.inspect_static_weight_patches()
version = view.version
for key, entries in view.entries.items():
    consumer.validate_supported_entries(key, entries)
# The consumer must explicitly copy/encode supported contents while it retains
# execution ownership. The view is NOT safe to hand to another process directly.
```

This inspection is insufficient to establish that the entire model configuration
can be reproduced in another process. The consumer must separately validate object
patches, model options, callbacks, wrappers and other execution state.

## Motivation

An external worker may load the same base checkpoint but still compute a different
model if static weight patches applied on the parent are missing. Our adapter
currently reads `patcher.patches` and `patcher.patches_uuid` directly, validates
supported contents, transfers patch data and checks content hashes, keys, version
and per-rank acknowledgments before denoising.

We want an explicit supported boundary for the read side without requesting a
general distributed framework or changing ordinary inference. The receiving
worker still requires a separate application/reset adapter; this RFC does not
make that adapter public or solve its lifecycle requirements.

At the inspected ComfyUI revision
`b0f4b7b294ce482a2e071d9d762c133d38c7aa07`, `get_key_patches()` traverses model
state and includes base weights/conversion information. It serves a different
purpose from patch-only inspection. `add_patches()` and clone facilities are not
an exact cross-process export/import contract. Their behavior should not change.

The requirement is a stable read boundary, not necessarily the method proposed
here. Keeping this in a custom-node adapter is a valid alternative.

## Detailed design

### Scope and returned view

Provisional `inspect_static_weight_patches()` returns a record containing:

- `version`: an opaque static patch-set identity with equality semantics. It is
  not a cryptographic digest, durable identifier or proof of tensor immutability.
- `entries`: a read-only mapping of weight keys to ordered tuples of native patch
  entries. Each entry preserves patch strength, native payload, model strength,
  offset and existing transform slot semantics without reinterpretation.

The implementation copies mapping/list containers but borrows nested payloads
and tensors. The containers cannot be modified through the view. Nested objects
must not be mutated by the consumer; the API cannot enforce tensor immutability.
No automatic CPU copy, CUDA synchronization, checkpoint traversal, model clone,
patch application, or serialization occurs. Empty patches produce an empty view
with the current opaque version.

This is intentionally not named a snapshot or export operation: shallow container
copies do not isolate in-place tensor mutations. Retaining a view may extend the
lifetime of patch tensors and their memory allocations.

### Unsupported content and ownership

Dynamic weight hooks/wrappers and non-null custom patch transforms are rejected
explicitly rather than silently omitted from an apparently complete static view.
Native payload objects remain native objects: the API makes no claim that every
adapter is serializable. A consumer seeking transfer must allowlist supported
payloads and fail before using any partial export if it encounters an unknown
adapter, callable, or unsupported execution state.

Calls require caller-controlled exclusive execution ownership: patch addition,
removal, loading and in-place payload mutation must not occur during inspection
or subsequent encoding. This proposal adds no global lock and offers no thread-
atomicity guarantee. Comparing UUIDs cannot detect all in-place changes. If no
safe ownership point is available, the consumer must not use this API for transfer.

### Compatibility and impact

The ordinary inference path never calls the new API. It must not create workers,
initialize distributed packages, change callbacks, alter device selection or
change native memory-management policy on import or on normal generation.

DynamicVRAM and legacy patchers should expose the same logical inspection
contract without patching/unpatching, materializing full weights or changing
residency. Quantized base weights must not be dequantized or repacked by inspection.
No changes to existing `get_key_patches()`, `add_patches()` or clone semantics.

No H3 layout, timestep, masking, Ulysses math, NCCL topology selection or automatic
multi-GPU scheduling is placed in ModelPatcher. All are outside this proposal.

### Required implementation tests (not yet performed)

- Empty and multiple static patches preserve keys, ordering, strengths and offsets.
- Container mutation is rejected; borrowed tensor aliasing is documented/tested.
- Inspection does not change source patch state, callbacks or model residency.
- Unsupported hooks/transforms fail without returning partial success.
- No base `state_dict` traversal, implicit tensor copies or distributed imports.
- Clones, patch clear and version changes retain the documented identity behavior.
- Dynamic and legacy patchers obey the same contract, including quantized models.
- Existing consumers and native inference when the API is unused are unchanged.

Tests must distinguish proposed API behavior from the plugin's existing transfer
hash/key/ACK checks. This draft includes no core implementation or claimed results
for these acceptance tests.

## Drawbacks

Even a small public method creates a long-term API obligation around native patch
representations. Borrowed tensors are easy to misuse, and cross-process consumers
still need ownership, validation, serialization and receiving-side application.
A full immutable snapshot would be easier to reason about but adds potentially
large memory/copy costs and adapter-specific export requirements.

There is only one demonstrated motivating integration here; general usefulness
should be reviewed rather than assumed. A private adapter already works, and a
public read API alone may not justify the maintenance cost. There is no claim
that adding it improves performance or makes arbitrary multi-GPU inference safe.

## Alternatives

1. Keep private access in the custom node, pin tested revisions and maintain
   compatibility tests. No new core API; continued maintenance burden on consumers.
2. Expose only version and key inventory. Safer and smaller, but patch contents
   would still require private reads for this consumer.
3. Define an owned, CPU patch export with adapter-specific serializers. Stronger
   isolation, but more allocation, API scope and format/security responsibilities.
4. Send a native loader/LoRA recipe to workers. Avoids exporting patch objects, but
   may not describe downstream transformations and still needs consistency checks.
5. Adopt another maintained upstream interface if one fits this requirement.

## Adoption strategy

First discuss this draft and its ownership contract through the RFC process.
An eventual implementation is additive and opt-in, with no automatic migration
or new behavior for existing workflows. A consumer can feature-detect the API
and retain a version-checked private adapter until it is available.

The buqi-derived custom node remains independent of this RFC's acceptance.
Future receiving-side patch application, worker lifecycle and H3 extension seams
need separate design and review; this is not approval to integrate the full plugin.

### Evidence boundaries

Public PR #6 records earlier full-model validation on ComfyUI `99073836`.
Newer local compatibility work targets `b0f4b7b2`; its additional commits were
not published to PR #6 when this draft was prepared. Those local results motivate
the discussion but are not presented as remotely reproducible core API tests.

The integration retains limitations: full model replicas (no pooled VRAM),
independent INT8 sampler outputs not bit-identical, and no demonstrated general
mixed-GPU or more-than-two-rank support. These remain regardless of this proposal.

## Unresolved questions

- Is this boundary useful enough to be public, or should it stay in the plugin?
- Is a borrowed inspection view acceptable, or should an owned export be designed?
- How much native adapter representation should a supported interface expose?
- Is caller-owned execution sufficient, and where should its constraints be documented?
- Should this be a focused API issue instead of an RFC at this scope?
- Are there existing/planned interfaces maintainers prefer us to use instead?
