#!/usr/bin/env bash

LCC_JS="lccjs"
LCC_PLUS_JS="lccplusjs"

LCC_JS_PATH="node $(pwd)/src/core/lcc.js"

LCC_PLUS_JS_PATH="node $(pwd)/src/plus/lccplus.js"

if [[ $SHELL == *"zsh"* ]]; then # if the user is using zsh, then set the shell config to "~/.zshrc"
    SHELL_CONFIG_FILE="$HOME/.zshrc"
elif [[ $SHELL == *"bash"* ]]; then # if the user is using bash, then set the shell config to "~/.bashrc"
    SHELL_CONFIG_FILE="$HOME/.bashrc"
else # ADD SUPPORT FOR WINDOWS SHELLS LATER!!!
    echo "Unsupported shell: $SHELL. Please add aliases to shell config file manually, or use default scripts provided."
    exit 1
fi

if (! grep -q "alias $LCC_JS=" "$SHELL_CONFIG_FILE"); then # looks for the alias "lccjs" in the shell configuration file
    CONSENT="N"
    read -p "Do you consent to modifying the shell config file to add aliases for 'lccjs' and 'lccplusjs'? [y/N] " CONSENT
    CONSENT=$(echo "$CONSENT" | tr '[:upper:]' '[:lower:]')
    if [[ "$CONSENT" != "y" ]]; then
        echo "Aliases not created"
        exit 1
    fi
    echo "alias $LCC_JS='$LCC_JS_PATH'" >> "$SHELL_CONFIG_FILE" # adds the alias "lccjs" 
    echo "alias $$LCC_JS='$LCC_PLUS_JS_PATH'" >> "$SHELL_CONFIG_FILE" # adds the alias "lccplusjs" to the shell config file
    echo "Aliases '$LCC_JS' and '$LCC_PLUS_JS' added to $SHELL_CONFIG_FILE." # outputs the the user that the aliases have been successfully added
else # if the aliases already exist...
    echo "Aliases already exist in $SHELL_CONFIG_FILE. No changes made." # inform the user and move on
fi