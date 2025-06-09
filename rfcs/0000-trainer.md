
# RFC: ComfyUI Training Modules

- Start Date: 2025-03-01
- Target Major Version: TBD

## Summary

This RFC proposes the addition of training capabilities to ComfyUI, enabling users to create and fine-tune LoRA (Low-Rank Adaptation) models directly through the ComfyUI interface. The proposal includes a set of node implementations for loading image datasets, training LoRAs, visualizing training progress, and saving trained models.

## Basic example

The basic workflow would allow users to:

1. Load an image dataset:
![image](https://github.com/user-attachments/assets/3e00d09c-14ea-432d-a694-270ab13367ec)


2. Train a LoRA on these images:
![image](https://github.com/user-attachments/assets/e631e59a-9944-4fc2-b6dd-13e0f0c132f9)

3. Save the resulting LoRA:
![image](https://github.com/user-attachments/assets/dbcbf1e4-af13-4095-86e9-7c4eada23432)


4. Visualize training loss:
![image](https://github.com/user-attachments/assets/d036b420-ef6c-4d2e-af55-d25c11724623)


## Motivation

Currently, users who want to create custom LoRA models need to:

1. Use external tools and scripts for training, which often requires command-line expertise
2. Set up specialized environments for training
3. Manually move the trained models between systems

Adding training capabilities directly to ComfyUI would:

1. **Simplify the training workflow**: Users can train models in the same interface where they use them
2. **Increase accessibility**: Users without programming experience can customize models
3. **Enable rapid iteration**: The ability to train and immediately test models in the same interface
4. **Provide visual feedback**: Real-time visualization of the training process
5. **Maintain workflow continuity**: The entire model creation, training, and inference pipeline can be represented as a unified workflow

## Detailed design

The implementation consists of four main components:

### 1. Image Dataset Loading

Two nodes are proposed for loading image datasets:

- `LoadImageSetNode`: Loads individual images selected by the user
- `LoadImageSetFromFolderNode`: Loads all images from a specified folder

These nodes offer options for handling images of different sizes (stretch, crop, pad) and prepare the images for training.

```python
class LoadImageSetFromFolderNode:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "folder": (folder_paths.get_input_subfolders(), {"tooltip": "The folder to load images from."})
            },
            "optional": {
                "resize_method": (
                    ["None", "Stretch", "Crop", "Pad"],
                    {"default": "None"},
                ),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "load_images"
    CATEGORY = "loaders"
    EXPERIMENTAL = True
    DESCRIPTION = "Loads a batch of images from a directory for training."
```

### 2. LoRA Training Node

The `TrainLoraNode` is the core component that handles the training process:

```python
class TrainLoraNode:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model": (IO.MODEL, {"tooltip": "The model to train the LoRA on."}),
                "vae": (IO.VAE, {"tooltip": "The VAE model to use for encoding images for training."}),
                "positive": (IO.CONDITIONING, {"tooltip": "The positive conditioning to use for training."}),
                "image": (IO.IMAGE, {"tooltip": "The image or image batch to train the LoRA on."}),
                "batch_size": (IO.INT, {"default": 1, "min": 1, "max": 10000, "step": 1}),
                "steps": (IO.INT, {"default": 50, "min": 1, "max": 1000}),
                "learning_rate": (IO.FLOAT, {"default": 0.0003, "min": 0.0000001, "max": 1.0, "step": 0.00001}),
                "rank": (IO.INT, {"default": 8, "min": 1, "max": 128}),
                "optimizer": (["Adam", "AdamW", "SGD", "RMSprop"], {"default": "Adam"}),
                "loss_function": (["MSE", "L1", "Huber", "SmoothL1"], {"default": "MSE"}),
                "seed": (IO.INT, {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF}),
                "training_dtype": (["bf16", "fp32"], {"default": "bf16"}),
                "existing_lora": (folder_paths.get_filename_list("loras") + ["[None]"], {"default": "[None]"}),
            },
        }

    RETURN_TYPES = (IO.MODEL, IO.LORA_MODEL, IO.LOSS_MAP, IO.INT)
    RETURN_NAMES = ("model_with_lora", "lora", "loss", "steps")
    FUNCTION = "train"
    CATEGORY = "training"
    EXPERIMENTAL = True
```

The training process:
1. Takes a batch of images and encodes them using a VAE
2. Sets up LoRA layers for all eligible weights in the model
3. Configures an optimizer and loss function based on user selections
4. Performs gradient-based training for the specified number of steps
5. Returns the model with LoRA applied, the LoRA weights, a map of training losses, and the total training steps

### 3. Model Saving Node

The `SaveLoRA` node enables users to save their trained LoRA models:

```python
class SaveLoRA:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "lora": (IO.LORA_MODEL, {"tooltip": "The LoRA model to save."}),
                "prefix": (IO.STRING, {"default": "trained_lora"}),
            },
            "optional": {
                "steps": (IO.INT, {"forceInput": True}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save"
    CATEGORY = "loaders"
    EXPERIMENTAL = True
    OUTPUT_NODE = True
```

The node saves the LoRA weights in SafeTensors format, with a filename that includes the number of training steps and a timestamp.

### 4. Training Visualization Node

The `LossGraphNode` visualizes the training progress:

```python
class LossGraphNode:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "loss": (IO.LOSS_MAP, {"default": {}}),
                "filename_prefix": (IO.STRING, {"default": "loss_graph"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "plot_loss"
    OUTPUT_NODE = True
    CATEGORY = "training"
    EXPERIMENTAL = True
    DESCRIPTION = "Plots the loss graph and saves it to the output directory."
```

This node generates a graph showing the training loss over time, providing visual feedback on the training process.

### Supporting Components

The implementation also includes several support classes:

1. `TrainSampler`: A custom sampler that performs gradient updates during the sampling process
2. `LoraDiff` and `BiasDiff`: Weight wrapper classes that apply LoRA adaptations to model weights

## Drawbacks

1. **Resource Consumption**: Training is computationally intensive and may strain systems with limited resources
2. **UI Responsiveness**: Long training processes could make the ComfyUI interface less responsive
3. **Complexity**: Adding training capabilities increases the complexity of the ComfyUI codebase
4. **Learning Curve**: Users may need to understand more ML concepts to effectively use the training features

## Adoption strategy

1. **Experimental Flag**: Initially release nodes with the `EXPERIMENTAL = True` flag to indicate the developing nature of the feature
2. **Documentation**: Provide comprehensive documentation and tutorial workflows
3. **Gradual Feature Addition**: Start with basic LoRA training and expand to other training types based on user feedback
4. **Default Parameters**: Set sensible defaults to help users get started without deep ML knowledge

## Unresolved questions

1. **Memory Management**: How will the system handle memory during training, especially for large models and datasets?
2. **Checkpoint Frequency**: Should the system automatically save checkpoints during training to prevent loss of progress?
3. **Training Interruption**: How should the system handle interrupted training sessions?
4. **Hyperparameter Optimization**: Should the system provide tools for automatically finding optimal hyperparameters?
5. **Multi-GPU Support**: How will training utilize multiple GPUs if available?
6. **Integration with Existing Workflows**: How can trained models be seamlessly integrated into existing inference workflows?
7. **Performance Metrics**: Should additional metrics beyond loss be tracked and visualized?
8. **Dataset Preparation**: Should the system provide more tools for dataset curation and augmentation?

## Implementation Plan

### Phase 1: Basic LoRA Training

Initial implementation of the nodes described in this RFC.

### Phase 2: Enhanced Features

- Checkpoint saving during training
- More advanced training visualizations
- Support for additional training techniques (e.g., DreamBooth, Control model training like Control LoRA and IPA)

### Phase 3: Workflow Integration

- Templates for common training scenarios
- Integration with model merging and inference workflows
- Advanced dataset management tools

### Phase 4: Model Format

- New model format to improve model memory management and metadata of models in ComfyUI

## Links

<!--
  Both links below will be automatically filled in when you create the PR.
  You do not need to modify this section.
-->

- [Full Rendered Proposal]()

- [Discussion Thread]()

<!--
  Optional: Include any additional links to related issues or resources below
-->

---

**Important: Do NOT comment on this PR. Please use the discussion thread linked above to provide feedback, as it provides branched discussions that are easier to follow. This also makes the edit history of the PR clearer.**
