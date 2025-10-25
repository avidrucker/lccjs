#!/usr/bin/env bash

LCC_JS="lccjs"
LCC_PLUS_JS="lccplusjs"
HEX_DISPLAY="hex"
PICTURE="picture"

LCC_JS_PATH="node $(pwd)/src/core/lcc.js"
LCC_PLUS_JS_PATH="node $(pwd)/src/plus/lccplus.js"
HEX_DISPLAY_PATH="node $(pwd)/src/utils/hexDisplay.js"
PICTURE_PATH="node $(pwd)/src/utils/picture.js"

if [[ $SHELL == *"zsh"* ]]; then # if the user is using zsh, then set the shell config to "~/.zshrc"
    SHELL_CONFIG_FILE="$HOME/.zshrc"
elif [[ $SHELL == *"bash"* ]]; then # if the user is using bash, then set the shell config to "~/.bashrc"
    SHELL_CONFIG_FILE="$HOME/.bashrc"
else # ADD SUPPORT FOR WINDOWS SHELLS LATER!!!
    echo "Unsupported shell: $SHELL. Please add aliases to shell config file manually, or use default scripts provided."
    exit 1
fi

# Check if any of the aliases already exist
if (grep -q "alias $LCC_JS=" "$SHELL_CONFIG_FILE" && \
    grep -q "alias $LCC_PLUS_JS=" "$SHELL_CONFIG_FILE" && \
    grep -q "alias $HEX_DISPLAY=" "$SHELL_CONFIG_FILE" && \
    grep -q "alias $PICTURE=" "$SHELL_CONFIG_FILE"); then
    echo "One or more aliases already exist in $SHELL_CONFIG_FILE. No changes made."
    exit 0
fi

# If no aliases exist, prompt for consent
CONSENT="N"
read -p "Do you consent to modifying the shell config file to add aliases for 'lccjs', 'lccplusjs', 'hex', and 'picture'? [y/N] " CONSENT
CONSENT=$(echo "$CONSENT" | tr '[:upper:]' '[:lower:]')
if [[ "$CONSENT" != "y" ]]; then
    echo "Aliases not created"
    exit 1
fi

# Add aliases to the shell config file
echo "alias $LCC_JS='$LCC_JS_PATH'" >> "$SHELL_CONFIG_FILE" # adds the alias "lccjs" 
echo "alias $LCC_PLUS_JS='$LCC_PLUS_JS_PATH'" >> "$SHELL_CONFIG_FILE" # adds the alias "lccplusjs" to the shell config file
echo "alias $HEX_DISPLAY='$HEX_DISPLAY_PATH'" >> "$SHELL_CONFIG_FILE" # adds the alias "hex" to the shell config file
echo "alias $PICTURE='$PICTURE_PATH'" >> "$SHELL_CONFIG_FILE" # adds the alias "picture" to the shell config file
echo "Aliases '$LCC_JS', '$LCC_PLUS_JS', '$HEX_DISPLAY', and '$PICTURE' added to $SHELL_CONFIG_FILE." # outputs to the user that the aliases have been successfully added