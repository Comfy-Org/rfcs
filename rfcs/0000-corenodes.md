# RFC: Core Nodes Expansion

- Start Date: 2025-02-18
- Target Major Version: TBD
- Reference Issues:
- Implementation PR:

## Summary

This RFS focuses on adding some long-requested nodes to core ComfyUI, both unifying their behavior across a bunch of custom node implementations and making the core node features more robust. Mainly, the nodes proposed here would involve string manipulation, int/float manipulation via a unified 'number' type, and preview options for masks, strings, and miscellaneous types.

## Motivation

If something is implemented many times in different custom nodes with the same goal, it is clear it is a feature that should be in core. There are many math nodes, string nodes, preview nodes, etc., many with slight variations in behavior.

In the past, one of the counterarguments for having basic nodes like this was to avoid ComfyUI becoming a 'visual programming' UI, but at its core that is what ComfyUI actually is - abstracting away the coding details of generative AI and leaving the bits relevant to its operation. Since these custom nodes exist anyway, that argument is void since users still have access to such features in ComfyUI.

Having multiple custom nodes doing the same thing but slightly differently, or relevant nodes that should be in core being part of massive node packs, makes for a frustrating experience. Going forward, nodes that do simple things across multiple node packs should be considered for RFCs that bring them into core ComfyUI.

## Detailed design

This will be more of a list of nodes considered to have a core implementation.

### Preview Nodes

1. Preview Mask
This would be identical to the Preview Image node, except take mask as input. Alternatively, the existing Preview Image node could have its ```image``` input be defined as ```(IMAGE,MASK)``` so that it could accept both IMAGE and MASK. The code would simply need to be updated to support the tensor format to display it. A Preview Mask node exists in (ComfyUI_essentials)[https://github.com/cubiq/ComfyUI_essentials] node pack.

2. Preview Any
Strings, integers, floats, etc. should be previewable. This is long requested and has a number of existing implementations. In the case of the SaveImages node in nodes.py, ```return { "ui": { "images": results } }``` is used to report the images that should be seen in the UI; something similar would need to be done to support strings, and then arbitrary types could also just have their string representations displayed.

From a quick google search, one node pack that includes a text preview is (ComfyUI_Custom_Nodes_AlekPet)[https://github.com/AlekPet/ComfyUI_Custom_Nodes_AlekPet/blob/master/ExtrasNode/extras_node.py], with 1k+ stars.

### String Nodes

While core ComfyUI uses string inputs, it technically has no nodes that output strings, and that was the reason why no core string manipulation nodes were implemented. That should change, given how often strings are used, whether for prompts or filenames.

1. Basic String Manipulation
There should be an assortment of string nodes that do common, basic string operations, such as: String Concatenate, String Replace, String Trim, String Select (beginning index, end index). List is not exhaustive; more basic operations can be supported. Existing custom nodes that do this sort of thing should be looked at, to make sure core implementation supports desired features.

### Number Nodes (Math)

Many, many workflows perform some math operations on ints or floats, whether to adjust cropping or get an even division of something.

It would be redundant to have nodes specifically for ints and floats - ideally, 'math nodes' should output a ```NUMBER``` type that can be converted to either INT or FLOAT, and 'number' inputs would really be typed as ```(INT,FLOAT,NUMBER)``` for easy use.

1. Basic Math
Examples: Add (variable inputs), Subtract (variable inputs), Multiply (variable inputs), Divide (variable inputs), Power, Floor, Ceiling, Round. List is not exhaustive; more basic operations can be added. Existing custom nodes that do this sort of thing should be looked at, to make sure core implementation supports desired features.

2. Convert From Number
Takes a NUMBER as input, and has two outputs: INT and FLOAT.

## Drawbacks

The primary drawback to math and string helpers is that since there are multiple node packs that already do these things, adding them in core in a way contributes to the 'yet another standard' problem. If the core ComfyUI implementation of these nodes is not satisfactory, it will result in even more nodes that do-the-same-thing-but-slightly-differently.

The execution of this RFC will ultimately determine whether this drawback is valid or not.

## Alternatives

Multiple custom nodes already exist that do everything this RFC proposes, in various subsets.

## Adoption strategy

Existing nodes would not be impacted, but new workflows can be created to preview/manipulate strings/do math without the need for multiple custom node packs. Nodes that wish to preview strings or arbitrary types as strings would no longer need to implement their own methods of displaying values in the UI.

## Unresolved questions

Optional, but suggested for first drafts. What parts of the design are still
TBD?
