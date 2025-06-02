# RFC: TEST - Enhanced Discussion Workflow Integration

- Start Date: 2025-01-06
- Target Major Version: (1.x)
- Reference Issues: N/A - Testing enhanced workflow
- Implementation PR: (leave this empty)

## Summary

This is a **TEST RFC** to verify the enhanced discussion integration workflow. It should automatically create a rich discussion with full proposal content and demonstrate the sync capabilities when the RFC is updated.

## Basic example

```javascript
// Test content to verify workflow functionality
console.log("Testing enhanced RFC discussion workflow");

function testWorkflow() {
  return {
    autoDiscussionCreation: true,
    fullContentEmbedding: true,
    autoSync: true,
    forkCompatibility: true
  };
}
```

## Motivation

We need to test that:

1. **Rich Discussion Creation**: Discussions include full RFC content, author info, and useful links
2. **Automatic Sync**: When RFCs are updated via PR commits, discussion content updates automatically  
3. **Better Formatting**: Discussions use proper markdown with sections and metadata
4. **Fork Compatibility**: Works with `pull_request_target` for fork contributions

This test will validate all these features work as expected.

## Detailed design

### Enhanced Discussion Features

The workflow improvements include:

- **Author Attribution**: Displays RFC author prominently
- **Status Indicators**: Shows current RFC status with emoji indicators
- **Quick Links Section**: Provides easy access to PR, changes, and rendered proposal
- **Embedded Content**: Full RFC content is embedded and stays current
- **Metadata Display**: Shows last updated timestamp and commit information
- **Sync Capabilities**: Automatically updates when PR content changes

### Technical Implementation Details

1. **Creation Workflow**: Enhanced `rfc-discussion.yml` extracts RFC content from PR
2. **Sync Workflow**: New `sync-rfc-discussion.yml` monitors for PR updates  
3. **GraphQL Integration**: Uses GitHub's discussion API for content updates
4. **Content Extraction**: Fetches RFC content from PR branch using GitHub API
5. **Template Generation**: Builds discussion body with structured sections

## Drawbacks

- More complex workflow configuration
- Additional GitHub API calls for content fetching and updates
- Potential for larger discussion bodies with embedded content

## Alternatives

- Keep simple discussion format with minimal content
- Use manual discussion updates instead of automation
- Rely on PR comments rather than dedicated discussions

## Adoption strategy

This is a workflow enhancement that improves the RFC process without affecting existing RFCs or requiring changes from RFC authors. The enhanced discussions provide better visibility and engagement.

## Unresolved questions

- Should we add diff information in sync updates?
- How should we handle very large RFC files?
- Should we include additional metadata like file size or word count?

---

**Note**: This is a TEST RFC - it will be deleted after verifying the workflow functions correctly.