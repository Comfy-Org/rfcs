# RFC: \install all custom_nodes requirements.txt in one click

- Start Date: 2025-04-25
- Target Major Version: (1.0)
- Reference Issues: (fill in existing related issues, if any)
- Implementation PR: (leave this empty)

## Summary

This tool automates the installation of dependencies for all custom nodes in a ComfyUI installation, streamlining the setup process for users with multiple custom nodes.

## Basic example

- Batch Script (install_custom_nodes.bat):

@echo off
setlocal EnableDelayedExpansion

:: Get the directory where the batch script is located (C:\Tools\Comfy-Portable)
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: Assume ComfyUI is in a subdirectory named 'ComfyUI'
set "COMFYUI_DIR=%SCRIPT_DIR%\ComfyUI"
set "VENV_PATH=%COMFYUI_DIR%\venv"
set "SCRIPT_PATH=%COMFYUI_DIR%\install_custom_nodes_requirements.py"

:: Check if ComfyUI directory exists
if not exist "%COMFYUI_DIR%" (
    echo Error: ComfyUI directory not found at %COMFYUI_DIR%
    pause
    exit /b 1
)

:: Check if virtual environment exists
if not exist "%VENV_PATH%\Scripts\activate.bat" (
    echo Error: Virtual environment not found at %VENV_PATH%
    pause
    exit /b 1
)

:: Check if install_custom_nodes_requirements.py exists
if not exist "%SCRIPT_PATH%" (
    echo Error: install_custom_nodes_requirements.py not found at %SCRIPT_PATH%
    pause
    exit /b 1
)

echo Activating virtual environment...
call "%VENV_PATH%\Scripts\activate.bat"
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to activate virtual environment at %VENV_PATH%
    pause
    exit /b %ERRORLEVEL%
)

echo Running install_custom_nodes_requirements.py...
cd /d "%COMFYUI_DIR%"
python "%SCRIPT_PATH%"
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to execute install_custom_nodes_requirements.py
    pause
    exit /b %ERRORLEVEL%
)

echo Installation complete.
pause
endlocal

- Python Script (install_custom_nodes_requirements.py):

import os
import subprocess
import sys

def activate_venv(venv_path):
    """Activate the virtual environment by updating PATH and VIRTUAL_ENV."""
    activate_script = os.path.join(venv_path, "Scripts", "activate.bat")
    if not os.path.exists(activate_script):
        print(f"Error: Virtual environment not found at {venv_path}")
        sys.exit(1)
    
    venv_bin = os.path.join(venv_path, "Scripts")
    os.environ["PATH"] = f"{venv_bin};{os.environ['PATH']}"
    os.environ["VIRTUAL_ENV"] = venv_path
    print(f"Activated virtual environment: {venv_path}")

def install_requirements(custom_nodes_dir):
    """Install requirements.txt from each custom node directory."""
    if not os.path.exists(custom_nodes_dir):
        print(f"Error: Custom nodes directory not found at {custom_nodes_dir}")
        sys.exit(1)

    for node_dir in os.listdir(custom_nodes_dir):
        node_path = os.path.join(custom_nodes_dir, node_dir)
        if os.path.isdir(node_path):
            requirements_file = os.path.join(node_path, "requirements.txt")
            if os.path.exists(requirements_file):
                print(f"Found requirements.txt in {node_dir}. Installing...")
                try:
                    result = subprocess.run(
                        [sys.executable, "-m", "pip", "install", "-r", requirements_file],
                        capture_output=True,
                        text=True,
                        check=True
                    )
                    print(f"Successfully installed requirements for {node_dir}")
                    print(result.stdout)
                except subprocess.CalledProcessError as e:
                    print(f"Error installing requirements for {node_dir}:")
                    print(e.stderr)
            else:
                print(f"No requirements.txt found in {node_dir}")

def main():
    comfyui_dir = r"C:\Tools\Comfy-Portable\ComfyUI"
    venv_path = os.path.join(comfyui_dir, "venv")
    custom_nodes_dir = os.path.join(comfyui_dir, "custom_nodes")

    activate_venv(venv_path)
    install_requirements(custom_nodes_dir)

if __name__ == "__main__":
    main()


## Motivation

Currently users are getting highly frustrated when they break their venv. Some installations like sageattention + triton require different cuda, pytorch, cuddn configurations and 3d-pack others. To sort this out more easily and to repair the dependencies for all custom_nodes this can be an update_all feature targeted for custom_node requirements

## Detailed design

Functionality:

- Batch Script (install_custom_nodes.bat): A Windows batch script that activates the ComfyUI virtual environment and executes the Python script. It is placed one directory above the ComfyUI folder (e.g., C:\Tools\Comfy-Portable), dynamically locates the ComfyUI directory, and ensures the virtual environment and Python script are correctly accessed.

- Python Script (install_custom_nodes_requirements.py): Scans the custom_nodes directory (e.g., C:\Tools\Comfy-Portable\ComfyUI\custom_nodes) for requirements.txt files in each custom node subdirectory. It is placed in the ComfyUI folder (e.g., C:\Tools\Comfy-Portable\ComfyUI). It installs the specified dependencies using pip within the ComfyUI virtual environment, skipping nodes without requirements.txt.

Features:
- Automates dependency installation for custom nodes like comfyui-reactor, ComfyUI-Manager, etc.
- Handles permissions issues by recommending Administrator mode.
- Skips already installed packages to avoid redundant installations.
- Provides clear output for success or errors per node.

Benefits:
- Saves time for users managing numerous custom nodes.
- Reduces errors from manual dependency installation.
- Portable and adaptable to different ComfyUI directory structures.

Use Case:
Ideal for ComfyUI users with extensive custom node setups.

## Drawbacks

Why should we *not* do this? Please consider:

- In case you have a better feature coming up to install dependencies
- I have tested it in a Portable version and in Stability Matrix.

## Alternatives

Currently users are getting highly frustrated when they break their venv. Some installations like sageattention + triton require different cuda, pytorch, cuddn configurations and 3d-pack others. To sort this out more easily and to repair the dependencies for all custom_nodes this can be an update_all feature targeted for custom_node requirements

## Adoption strategy

I assume the adoption will happen organically. Power-users will notice the new .bat and slowly more and more users will now about this feature.

## Unresolved questions

Optional, but suggested for first drafts. What parts of the design are still
TBD?
