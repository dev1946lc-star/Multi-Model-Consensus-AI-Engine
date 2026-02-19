// @ts-nocheck
/* ──────────────────────────────────────────
   Chat Panel Client-Side JavaScript
   ────────────────────────────────────────── */

(function () {
    const vscode = acquireVsCodeApi();

    const messagesEl = document.getElementById('messages');
    const loadingEl = document.getElementById('loading');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const actionButtons = document.querySelectorAll('#actions button');

    // ── Send message ──
    function sendMessage(type, instruction) {
        if (!instruction || !instruction.trim()) return;
        vscode.postMessage({ type, instruction: instruction.trim() });
    }

    // Send button click
    sendBtn.addEventListener('click', () => {
        const text = userInput.value;
        if (text.trim()) {
            sendMessage('ask', text);
            userInput.value = '';
        }
    });

    // Enter to send (Shift+Enter for newline)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    // Action buttons
    actionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'ask' || action === 'create') {
                // Use the input field text or prompt
                const text = userInput.value.trim();
                if (text) {
                    sendMessage(action, text);
                    userInput.value = '';
                } else {
                    userInput.focus();
                    userInput.placeholder = action === 'create'
                        ? 'Describe the file to create...'
                        : 'Type your question...';
                }
            } else {
                // fix, explain, refactor — work on selection
                const presets = {
                    fix: 'Fix the bugs in the selected code',
                    explain: 'Explain the selected code in detail',
                    refactor: 'Refactor the selected code for better quality',
                };
                sendMessage(action === 'fix' ? 'edit' : 'ask', presets[action]);
            }
        });
    });

    // ── Receive messages from extension ──
    window.addEventListener('message', (event) => {
        const msg = event.data;

        switch (msg.type) {
            case 'addMessage':
                addMessageToUI(msg.role, msg.content, msg.consensus);
                break;

            case 'setLoading':
                loadingEl.classList.toggle('hidden', !msg.loading);
                if (msg.loading) {
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                }
                break;

            case 'setConnected':
                const statusEl = document.getElementById('connection-status');
                statusEl.textContent = msg.connected ? 'Connected' : 'Disconnected';
                statusEl.className = 'status ' + (msg.connected ? 'connected' : 'disconnected');
                break;
        }
    });

    // ── Add a message to the chat UI ──
    function addMessageToUI(role, content, consensus) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message ' + role;

        const roleEl = document.createElement('div');
        roleEl.className = 'role';
        roleEl.textContent = role === 'user' ? '🧑 You' : '🤖 AI';
        messageEl.appendChild(roleEl);

        const contentEl = document.createElement('div');
        contentEl.className = 'content';
        contentEl.textContent = content;
        messageEl.appendChild(contentEl);

        // Add consensus badge for assistant messages
        if (role === 'assistant' && consensus) {
            const badge = createConsensusBadge(consensus);
            messageEl.appendChild(badge);
        }

        messagesEl.appendChild(messageEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // ── Create consensus info badge ──
    function createConsensusBadge(consensus) {
        const badge = document.createElement('div');
        badge.className = 'consensus-badge';

        // Models used
        const modelsHtml = consensus.modelsUsed
            .map((m) => {
                const isWinner = m === consensus.winnerModel;
                return `<span class="model-tag ${isWinner ? 'winner' : ''}">${m}${isWinner ? ' ✓' : ''}</span>`;
            })
            .join(' ');

        badge.innerHTML = `
      <div><span class="label">Models:</span> ${modelsHtml}</div>
      <div><span class="label">Strategy:</span> <span class="value">${consensus.mergeStrategy}</span></div>
      <div><span class="label">Consensus:</span> <span class="value">${Math.round(consensus.consensusScore * 100)}%</span></div>
      <div><span class="label">Confidence:</span> <span class="value">${Math.round(consensus.confidence * 100)}%</span></div>
    `;

        return badge;
    }

    // Focus input on load
    userInput.focus();
})();
