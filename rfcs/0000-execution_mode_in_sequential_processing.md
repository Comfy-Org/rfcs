# RFC: Execution mode in sequential processing

- Start Date: 2026-01-14
- Target Major Version: 0.10
- Reference Issues: https://github.com/Comfy-Org/ComfyUI/issues/11131
- Implementation PR: (leave this empty)

## Summary

ComfyUI provides [data lists](https://docs.comfy.org/custom-nodes/backend/lists) which cause nodes to process multiple times. This is very useful for workflows which make use of multiple assets (images, prompts, etc.). However, the "multiple processing of a single node" stalls the workflow on the node and ComfyUI should pass on execution to the next node after each result and provide a way to control execution mode in sequential processing.

## Motivation

> Why are we doing this? What use cases does it support? What is the expected outcome?
> Please focus on explaining the motivation so that if this RFC is not accepted, the motivation could be used to develop alternative solutions. In other words, enumerate the constraints you are trying to solve without coupling them too closely to the solution you have in mind.

### Simple example

In the following example, the node `String OutputList` is marked as `OUTPUT_IS_LIST=True` (a data list) and tells `KSampler` to fetch and process the items sequentially. Notice how the `KSampler` executes 4 times:

https://github.com/user-attachments/assets/6bb38b4c-f00e-4636-8d23-277be547de18

I built a whole node pack around this useful but underutilized feature and it is very well received. It allows easy and native multi-prompt workflows, but again and again, users hit roadblocks because it only works well for small workflows but with larger and more advanced workflows the execution remains at one node for a very long time and also potentially builds up memory usage and OOM.

### XYZ-GridPlots

We often want to make image grids to compare how different parameters effect generation.

<img width="2890" height="820" alt="Image" src="https://github.com/user-attachments/assets/2a8d9686-b780-45e3-b38b-13ab791d776c" />

In this example the `KSampler` processes ALL combinations before the next nodes (`VAE Decode > Save Image`) which can take a very long time and you could loose all progress if something happens. Instead, we want to see and save the intermediate results of each image immediately.

### Iterate models

We often want to iterate over a list of models to compare how different checkpoints or LoRAs effect generation.

<img width="2350" height="736" alt="Image" src="https://github.com/user-attachments/assets/8a5b85b6-cf54-40e1-8336-ce20c71d34c1" />

In this example the node `Load Checkpoint` will load ALL checkpoints upfront before proceeding, which eventually leads to OOM.

### Bake parameters into workflow

We also want to bake parameters into the workflow JSON from a multi-image generating workflow to see which concrete parameter was used to generate a specific image. Otherwise, every image stores the same (multi-image generating) workflow.

<img width="1360" height="292" alt="Image" src="https://github.com/user-attachments/assets/758c72a7-8928-404e-9de4-b245a968e632" />

In this example the node `FormattedString` makes use of `extra_pnginfo` in the second (dynprompt) textfield to store the actually used prompt in the workflow. But this doesn't work because the node is processed for all items first and only stores the last entry before eventually proceeding to `SaveImage`. When you load any workflow from all the images they all only show the last entry.

### Multi-model workflows

Another usecase to consider are multi-model workflows. Let's say we have a list of prompts and want to process them in a powerful "iterate prompts -> generate image -> generate video -> upscale video" pipeline, but only one step will ever fit into VRAM. Thus we want to do something like "load image model -> generate ALL images -> unload image model -> load video model -> generate ALL videos -> unload video model -> upscale ALL videos". So this actually a counter-example because in this case we want the process the same node multiple times and thus we need some control over how the multi-processing should work in different use-cases.

## Detailed design

> This is the bulk of the RFC. Explain the design in enough detail for somebody familiar with Vue to understand, and for somebody familiar with the implementation to implement. This should get into specifics and corner-cases, and include examples of how the feature is used. Any new terminology should be defined here.

I'm not a core developer and cannot provide implementation details, only describe how it would appear to the user. Please note that "node expansion" already provides some features and is discussed in "Alternative Solutions" below!

### Change 1 - Pass on execution immediately

The first change I propose is to change the execution scheme to **pass on execution immediately after each result instead of processing the same node multiple times at once**.

I would argue that all the examples above except "Multi-model workflows" are the more common case and "Multi-model workflow" is very special and advanced. The default behaviour should cover the more common and simple cases, because advanced workflows are designed by advanced users anyway, who know what to do. And secondly, then it doesn't require "Change 4 - Passthrough inputs for ALL output nodes".

The next two proposed changes concern how the execution mode can be changed for single nodes and group of nodes. If "pass on execution immediately" is the default execution mode, all the simple examples would work out-of-the-box and only the "multi-model workflows" would require a configuration on 2 single KSamplers to work. If we don't change it, all the simple examples would require a configuration on a GROUP of nodes.

But whatever the default case is, there has to be a way to change execution mode, either for one node or a group of nodes. This is discussed in the next two proposed changes.

### Change 2 - Control execution for a single node

The other point to discuss would be - whether or not the default execution scheme is actually changed - HOW we set a single node or group of nodes to the other execution mode. The single node case is trivial, just add a context menu entry and some icon that the node uses a different execution mode.

### Change 3 - Control execution for a group of nodes

For a group of nodes the change is more complicated because we have to have a way to define which nodes are covered and a visual to see which nodes are effected. The following discusses different options on how the execution mode can be changed for a group of nodes:

#### Option a) Subgraphs

Add an option for subgraph "treat as sequential unit".

<img width="806" height="304" alt="Image" src="https://github.com/user-attachments/assets/370a92bd-95df-44e3-beef-30e16132a476" />

- Pro: Subgraphs already covers the concept of groups
- Con: Requires hierachical treatment of data lists, otherwise subgraphs would work differently if they are executed as a standalone workflow. Let's say there is output list outside of the subgraph, then the whole subgraph executes as a whole on this item. If there is another output list within the subgraph, the behaviour should work like data lists work now (but what if different hierarchical layers are intertwined?).

#### Option b) Add Group (box)

When the box is set as "sequential unit" all nodes within the box execute differently (the actual UI should be different of course, like a context menu entry and a icon which visualizes the change)

<img width="648" height="340" alt="Image" src="https://github.com/user-attachments/assets/d8bef0e7-120e-4722-8438-4d75b4e76eb5" />

- Pro: easy to mark
- Con: could lead to ambiguous situations when only half of a graph flow is marked

#### Option c) onExecuted/onTrigger

I don't know what the original intention for this feature was and I don't really understand it but it could be used to the tell `KSampler`: "after you have executed, trigger this `SaveImage` node immediately".. which then looks upstream until it finds the `KSampler` and fetches the item downstream. It only needs to be actually implemented.

<img width="853" height="378" alt="Image" src="https://github.com/user-attachments/assets/32447fd0-4693-479c-90ef-99c8af312657" />

- Pro: it somewhat already allows to control execution, so maybe this RFC is just an argument to finally implement it
- Con: has to be implemented first

Also see:
* comfyanonymous/ComfyUI#704
* comfyanonymous/ComfyUI#1135
* comfyanonymous/ComfyUI#7443

There is a PR which implemented this and I tried it here: https://github.com/comfyanonymous/ComfyUI/pull/7443#issuecomment-3592346229 but it didn't work. Maybe all it takes is that onExecuted fires on every item.

And would this work with the example "Iterate models"? e.g. "load 'checkpoint 1' onExecuted -> trigger unload 'checkpoint 1', then proceed with 'checkpoint 2'". Or would the caching strategy already cover the unloading of checkpoint 1 after usage?

#### Option d) Group nodes

(Just for completeness sake, not seriously considered)

<img width="570" height="653" alt="Image" src="https://github.com/user-attachments/assets/ae897aa5-b1a6-4eb8-b3ea-54f50d14115b" />

- Pro: same as subgraph
- Con: Groups have been deprecated

### Change 4 - Passthrough inputs for ALL output nodes

The following change is only required, if the execution scheme stays as it is. It is almost possible to display the intermediate results with for-loops already, except that output nodes would need to passthrough the inputs as an output knob, in order for the for-loop to consider the node as a part of the node expansion (see "Alternatives - node expansion at runtime").

## Drawbacks

> Why should we *not* do this? Please consider:

> - implementation cost, both in term of code size and complexity

I don't know. From an execution point of view the processing would jump around in the graph back and forth multiple times:
a) single diffusion workflow: executes the same as now
b) multiple inputs (from a data list) into a single diffusion workflow: fetch one item, execute the whole graph, then jump back to the input list, fetch the next item, repeat. the output node (Save Image) is populated one-by-one.
c) multiple inputs with a node that has `INPUT_IS_LIST=true`: same as `b` except all results are collected in this node before proceeding downstream
d) multiple inputs with a `KSampler` that is set to `execute multiple times` (see "multi-model workflow"): same as c except all the results are collected in the KSampler before proceeding downstream

So maybe this could effect:
1. Muting/Bypassing and any flow-control nodes
2. All output nodes which support image lists: Save Image or Preview Image would populate the list one by one (or at least save one by one if we don't care about the visual presentation).
3. Caches would build up differently and probably need different optimization strategies if the executor knows that a part of a graph won't be executed anymore.

On the other hand, it already works with node expansion, so everything should work out-of-the-box already?

> - whether the proposed feature can be implemented in user space

Yes, see "ad-hoc node expansion" but this solution is either complicated or ambigious, and has some drawbacks.

> - the impact on teaching people ComfyUI
> - cost of migrating existing ComfyUI applications (is it a breaking change?)

I consider the impact of teaching and migrating small, because it only applies to advanced workflows and the change is simply "from now on, nodes pass on execution immediately".

> - integration of this feature with other existing and planned features

onExecuted/onTrigger could be effected by this

> There are tradeoffs to choosing any path. Attempt to identify them here.

has been discussed

## Alternatives

> What other designs have been considered?

### a) custom node expansion

The only solution so far I've found is to copy the node pattern, e.g. `KSampler > VAE Decode > Save Image`, as a custom node with node expansion in code:

<img width="2490" height="748" alt="Image" src="https://github.com/user-attachments/assets/1be7d128-8c74-4087-b106-24e378c96c7f" />

```
class KSamplerImmediateSave:
	DESCRIPTION="""Node Expansion of default KSampler, VAE Decode and Save Image to process as one.
This is useful if you want to save the intermediate images for grids immediately.
'A custom KSampler just to save an image? Now I have become the very thing I sought to destroy!'
"""
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				# from ComfyUI/nodes.py KSampler
				"model"	: ("MODEL"	, { "tooltip" : "The model used for denoising the input latent." } ) ,
				"positive"	: ("CONDITIONING"	, { "tooltip" : "The conditioning describing the attributes you want to include in the image." } ) ,
				"negative"	: ("CONDITIONING"	, { "tooltip" : "The conditioning describing the attributes you want to exclude from the image." } ) ,
				"latent_image"	: ("LATENT"	, { "tooltip" : "The latent image to denoise." } ) ,
				"vae"	: ("VAE"	, { "tooltip" : "The VAE model used for decoding the latent." } ) ,

				"seed"	: ("INT"	, {"default" :	0	, "min" :	0	, "max" :	0xfffffffffffffff	, "control_after_generate" : True,	"tooltip" : "The random seed used for creating the noise." } ) ,
				"steps"	: ("INT"	, {"default" :	20	, "min" :	1	, "max" :	10000	,	"tooltip" : "The number of steps used in the denoising process." } ) ,
				"cfg"	: ("FLOAT"	, {"default" :	8.0	, "min" :	0.0	, "max" :	100.0	, "step" : 0.1, "round" : 0.01,	"tooltip" : "The Classifier-Free Guidance scale balances creativity and adherence to the prompt. Higher values result in images more closely matching the prompt however too high values will negatively impact quality." } ) ,
				"sampler_name"	: (comfy.samplers.KSampler.SAMPLERS	, {"tooltip" : "The algorithm used when sampling , this can affect the quality , speed , and style of the generated output." } ) ,
				"scheduler"	: (comfy.samplers.KSampler.SCHEDULERS	, {"tooltip" : "The scheduler controls how noise is gradually removed to form the image." } ) ,
				"denoise"	: ("FLOAT"	, {"default" :	1.0	, "min" :	0.0	, "max" :	1.0	, "step" : 0.01,	"tooltip" : "The amount of denoising applied , lower values will maintain the structure of the initial image allowing for image to image sampling." } ) ,

				# from ComfyUI/nodes.py SaveImage
				"filename_prefix"	: ("STRING", {"default" : "ComfyUI", "tooltip" : "The prefix for the file to save. This may include formatting information such as %date :yyyy-MM-dd% or %Empty Latent Image.width% to include values from nodes."}),
			},
			# "hidden": {
			#	"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO",
			# },
		}

	RETURN_NAMES	= ("image", )
	RETURN_TYPES	= ("IMAGE", )
	OUTPUT_TOOLTIPS	= ("The decoded image.",) # from ComfyUI/nodes.py VAEDecode
	OUTPUT_NODE	= True
	FUNCTION	= "execute"
	CATEGORY	= "_for_testing"

	def execute(self, model, positive, negative, latent_image, vae, seed, steps, cfg, sampler_name, scheduler, denoise, filename_prefix):
		graph	= GraphBuilder()
		latent	= graph.node("KSampler" , model=model, positive=positive, negative=negative, latent_image=latent_image, seed=seed, steps=steps, cfg=cfg, sampler_name=sampler_name, scheduler=scheduler, denoise=denoise)
		images	= graph.node("VAEDecode", samples=latent.out(0), vae=vae)
		save	= graph.node("SaveImage", images=images.out(0), filename_prefix=filename_prefix)
		return {
			"result" : (images.out(0),),
			"expand" : graph.finalize(),
		}
```

While this works with the default pattern in the simple example, it would require to reimplement each deviation as a new custom node in code.
* You want to use two samplers? New custom node
* You want to apply some image manipulation before saving? New custom node
* You want to include the Load Checkpoint for model iteration? New custom node
etc.

And you have to implement this in code and restart the server for every change.

### b) ad-hoc node expansion in editor

Because node expansion already works we could provide a feature "create node-expansion from selected nodes" which simply generates the node expansion code and provides it as a custom node (or blueprint or something). This could be implemented as a plugin or new feature.

### c) node expansion at runtime

Another solution to show the intermediate results that ALMOST works is "node expansion at runtime" a.k.a for-loops.

<img width="4044" height="1518" alt="ExampleAdv_08_ForLoops" src="https://github.com/user-attachments/assets/fc08bd59-c92c-4d0d-abaf-09b2a6cd1f45" />

I don't know how exactly for-loops work in ComfyUI, but it probably defines a start and end point, then searches for a path through the links, selects all the nodes involved and instantiates a copy of them via node expansion for every list item. The problem why this doesn't work is because every output node would need to passthrough their input in order to be considered a part of the node expansion, hence why their is a custom `Save Image Passthrough` node in this example. This could probably be fixed by adding a "and also include this output node"-knob to the for-loop but then the user's brain would explode. No one (NO ONE!) knows how for-loops actually work or how they are used, including the custom node developers themselves. So this not really a solution either.

Related discussion:
* https://github.com/geroldmeisinger/ComfyUI-outputlists-combiner/pull/33
* https://github.com/BadCafeCode/execution-inversion-demo-comfyui/issues/10

### d) The PrimitiveInt control_after_generate=increment pattern

A well known pattern to emulate multi-processing is the `Primitive Int` node with `control_after_generate=increment`. You basically get a counter that increases everytime you run a prompt. When you hook it up as a index in a list selector node, it iterates over entries across multiple prompts. In the Run toolbox you can set the amount of prompts to the number of items in your list to iterate the whole list. This pattern essentially cancels out the effect of output lists and will only ever process one item at a time.

<img width="1056" height="437" alt="Image" src="https://raw.githubusercontent.com/geroldmeisinger/ComfyUI-outputlists-combiner/main/media/PrimitiveIntControlAfterGenerateIncrement.png" />

> What is the impact of not doing this?

For any serious multi-image workflows the current sequential processing always runs into road blocks. Either we have to wait a long time to see intermediate results, where the progress could be lost, or it runs into OOM.

## Adoption strategy

> If we implement this proposal, how will existing ComfyUI users and developers adopt it? Is this a breaking change? How will this affect other projects in the ComfyUI ecosystem?

I don't see data lists wildly used right now although they should be as they are very powerful. As such I think breaking changes are minimal and only effect multi-image-multi-model workflows with model unloading (see examples above), which are very unlikely to exist.

## Unresolved questions

> Optional, but suggested for first drafts. What parts of the design are still TBD?

### onExecuted/onTrigger

I don't know how they work, maybe this is the solution already, but there is no documentation and they are not implemented yet. Maybe all it takes is that onExecuted fires for every item.
