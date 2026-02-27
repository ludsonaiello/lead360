#!/bin/bash

###############################################################################
# Voice AI Log Viewer
#
# Provides easy access to different log streams for Voice AI development
###############################################################################

LOGS_DIR="/var/www/lead360.app/logs"
VOICE_AI_LOG="$LOGS_DIR/voice-ai-calls.log"
API_LOG="$LOGS_DIR/api_access.log"
API_ERROR_LOG="$LOGS_DIR/api_error.log"

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}              ${MAGENTA}Voice AI Log Viewer - Lead360${NC}                    ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_log_file() {
    if [ ! -f "$VOICE_AI_LOG" ]; then
        echo -e "${RED}✗ Voice AI log file not found: $VOICE_AI_LOG${NC}"
        echo -e "${YELLOW}  Waiting for first call...${NC}"
        echo ""
    fi
}

###############################################################################
# Viewing Options
###############################################################################

# Option 1: View all Voice AI logs
view_all() {
    echo -e "${GREEN}📊 Viewing all Voice AI call logs (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG"
}

# Option 2: View only conversation (user speech + agent responses)
view_conversation() {
    echo -e "${GREEN}💬 Viewing conversation only (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep -E "User said|Agent response" --line-buffered
}

# Option 3: View only STT (speech-to-text)
view_stt() {
    echo -e "${GREEN}🎤 Viewing Speech-to-Text only (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep "STT" --line-buffered
}

# Option 4: View only LLM (language model)
view_llm() {
    echo -e "${GREEN}🧠 Viewing LLM requests/responses (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep "LLM" --line-buffered
}

# Option 5: View only TTS (text-to-speech)
view_tts() {
    echo -e "${GREEN}🔊 Viewing Text-to-Speech only (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep "TTS" --line-buffered
}

# Option 6: View only tool calls
view_tools() {
    echo -e "${GREEN}🔧 Viewing tool executions only (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep "TOOL_CALL" --line-buffered
}

# Option 7: View only errors
view_errors() {
    echo -e "${GREEN}❌ Viewing errors only (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep "ERROR" --line-buffered
}

# Option 8: View call lifecycle (start, end, transfer)
view_lifecycle() {
    echo -e "${GREEN}📞 Viewing call lifecycle events (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep -E "JOB_START|JOB_END|TRANSFER|CONTEXT_LOAD" --line-buffered
}

# Option 9: View session events (connection, audio tracks, etc.)
view_session() {
    echo -e "${GREEN}📡 Viewing session events (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep "SESSION" --line-buffered
}

# Option 10: View clean conversation flow (production-like)
view_clean() {
    echo -e "${GREEN}✨ Viewing clean conversation flow (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep -E "JOB_START|User said.*is_final.*true|Agent response|Tool executed|Transfer|JOB_END" --line-buffered
}

# Option 11: View last N lines
view_last() {
    echo -e "${YELLOW}How many lines to view? (default: 50)${NC}"
    read -r lines
    lines=${lines:-50}

    echo -e "${GREEN}📜 Viewing last $lines lines${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -n "$lines" "$VOICE_AI_LOG"
    echo ""
    echo -e "${YELLOW}Press Enter to return to menu...${NC}"
    read -r
}

# Option 12: View specific call
view_call() {
    echo -e "${YELLOW}Enter call SID (e.g., CA_xxxxx):${NC}"
    read -r call_sid

    if [ -z "$call_sid" ]; then
        echo -e "${RED}✗ No call SID provided${NC}"
        sleep 2
        return
    fi

    echo -e "${GREEN}📞 Viewing call: $call_sid (press Ctrl+C to exit)${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    tail -f "$VOICE_AI_LOG" | grep "$call_sid" --line-buffered
}

# Option 13: Multi-terminal view (splits into 3 terminals)
view_multi() {
    echo -e "${GREEN}🖥️  Opening multi-terminal view...${NC}"
    echo ""

    # Check if gnome-terminal is available
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal --tab --title="Full Voice AI Logs" -- bash -c "tail -f $VOICE_AI_LOG; exec bash" \
                       --tab --title="Conversation Only" -- bash -c "tail -f $VOICE_AI_LOG | grep -E 'User said|Agent response' --line-buffered; exec bash" \
                       --tab --title="Errors & Warnings" -- bash -c "tail -f $VOICE_AI_LOG | grep -E 'ERROR|WARN' --line-buffered; exec bash"
        echo -e "${GREEN}✓ Opened 3 terminal tabs${NC}"
    # Check if tmux is available
    elif command -v tmux &> /dev/null; then
        tmux new-session -d -s voice-ai-logs
        tmux split-window -h -t voice-ai-logs
        tmux split-window -v -t voice-ai-logs

        tmux send-keys -t voice-ai-logs:0.0 "tail -f $VOICE_AI_LOG" C-m
        tmux send-keys -t voice-ai-logs:0.1 "tail -f $VOICE_AI_LOG | grep -E 'User said|Agent response' --line-buffered" C-m
        tmux send-keys -t voice-ai-logs:0.2 "tail -f $VOICE_AI_LOG | grep -E 'ERROR|WARN' --line-buffered" C-m

        tmux attach-session -t voice-ai-logs
    # Check if screen is available
    elif command -v screen &> /dev/null; then
        screen -dmS voice-ai-logs bash -c "tail -f $VOICE_AI_LOG"
        echo -e "${GREEN}✓ Started screen session 'voice-ai-logs'${NC}"
        echo -e "${YELLOW}  Use 'screen -r voice-ai-logs' to attach${NC}"
    else
        echo -e "${RED}✗ No terminal multiplexer found (gnome-terminal, tmux, or screen)${NC}"
        echo -e "${YELLOW}  Install one with: sudo apt install tmux${NC}"
    fi

    sleep 2
}

# Option 14: Search logs
search_logs() {
    echo -e "${YELLOW}Enter search term:${NC}"
    read -r search_term

    if [ -z "$search_term" ]; then
        echo -e "${RED}✗ No search term provided${NC}"
        sleep 2
        return
    fi

    echo -e "${GREEN}🔍 Searching for: $search_term${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
    grep -i "$search_term" "$VOICE_AI_LOG" | tail -n 100
    echo ""
    echo -e "${YELLOW}Press Enter to return to menu...${NC}"
    read -r
}

# Option 15: Clear log file
clear_logs() {
    echo -e "${RED}⚠️  WARNING: This will clear all Voice AI logs!${NC}"
    echo -e "${YELLOW}Are you sure? (yes/no):${NC}"
    read -r confirm

    if [ "$confirm" = "yes" ]; then
        > "$VOICE_AI_LOG"
        echo -e "${GREEN}✓ Logs cleared${NC}"
    else
        echo -e "${YELLOW}Cancelled${NC}"
    fi

    sleep 2
}

###############################################################################
# Main Menu
###############################################################################

show_menu() {
    clear
    print_header
    check_log_file

    echo -e "${BLUE}┌─ Real-Time Views${NC}"
    echo -e "${BLUE}│${NC}"
    echo "  1) 📊 All Voice AI logs"
    echo "  2) 💬 Conversation only (user + agent)"
    echo "  3) 🎤 STT (Speech-to-Text) only"
    echo "  4) 🧠 LLM requests/responses only"
    echo "  5) 🔊 TTS (Text-to-Speech) only"
    echo "  6) 🔧 Tool executions only"
    echo "  7) ❌ Errors only"
    echo "  8) 📞 Call lifecycle (start/end/transfer)"
    echo "  9) 📡 Session events (audio tracks, etc.)"
    echo " 10) ✨ Clean conversation flow"
    echo ""
    echo -e "${BLUE}┌─ Special Views${NC}"
    echo -e "${BLUE}│${NC}"
    echo " 11) 📜 View last N lines"
    echo " 12) 🔍 View specific call (by SID)"
    echo " 13) 🖥️  Multi-terminal view (3 panels)"
    echo " 14) 🔎 Search logs"
    echo ""
    echo -e "${BLUE}┌─ Utilities${NC}"
    echo -e "${BLUE}│${NC}"
    echo " 15) 🗑️  Clear logs"
    echo "  q) Quit"
    echo ""
    echo -e "${YELLOW}Select an option:${NC} "
}

###############################################################################
# Main Loop
###############################################################################

main() {
    while true; do
        show_menu
        read -r choice

        case $choice in
            1) view_all ;;
            2) view_conversation ;;
            3) view_stt ;;
            4) view_llm ;;
            5) view_tts ;;
            6) view_tools ;;
            7) view_errors ;;
            8) view_lifecycle ;;
            9) view_session ;;
            10) view_clean ;;
            11) view_last ;;
            12) view_call ;;
            13) view_multi ;;
            14) search_logs ;;
            15) clear_logs ;;
            q|Q)
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                sleep 1
                ;;
        esac
    done
}

# Run the main menu
main
