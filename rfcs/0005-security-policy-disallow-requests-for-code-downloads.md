# RFC: Disallow use of downloading of external Python code that bypasses Registry auditing

- Start Date: 2025-01-14
- Target Major Version: N/A (Policy baseline)
- Reference Issues: https://github.com/Comfy-Org/docs/pull/50, https://github.com/1038lab/ComfyUI-OmniGen/issues/38
- Implementation PR: (leave this empty)

## Summary

Update Security Baseline Policy (for Registry, etc.) to include a restriction on 
using `requests` or other download mechanisms to bypass code auditing of code needed 
for custom modules.

## Motivation

As part of Security policy, we disallow and prohibit certain behaviors that may be 
added to custom modules uploaded ot the Registry. Certain behaviors such as using 
`subprocess` calls to do `pip install` or other commands to obtain libraries, etc. 
for use in a module are already prohibited.

However, it was discoverered in referenced issues on ComfyUI-OmniGen that the module 
relies on `requests` and a list of filenames and URL base paths to download and then 
later within the module import the separately downloaded OmniGen code-base.

Similar to the Ultralytics issue in December of 2024, this type of behavior introduces 
insecure behavior and can result in malicious code being downloaded and executed that 
is outside the scope of Registry security and peer auditing. While the Ultralytics problem 
was a result of hijacked GitHub secrets and publishing secrets, the same premise of hijacked 
third party code / download links still applies here. It is why we do not allow random 
`subprocess` calls to `pip install ...` commands outside of the module requirements lists, 
and similar reasoning should be applied to the use of `requests` or other direct downloading 
of files independently outside of the Registry audit process and security processing tooling 
or the requirements resolution tooling built into ComfyUI-Manager.

## Adoption strategy

If implemented, modules in the ComfyUI registry which are doing this behavior will be rejected 
on review, and modules currently in the ComfyUI registry found to be doing this behavior 
will need security issues raised against their repositories. Module developers will need to 
either adjust their requirements or similar to package the externally-obtained libraries in 
their codebase or otherwise have suitable ways to ship the code (via `git submodule` or 
direct codebase inclusion of such libraries / dependencies) or risk removal of the module from 
the Registry.

## Unresolved questions

We do not currently have any clear way of detecting these activities in the code currently 
in code auditing tooling, however we could develop YARA rules or other analysis rules 
which would be able to detect the potential misuse of `requests` library calls, as seen 
in the ComfyUI-OmniGen modules, in future module uploads.
