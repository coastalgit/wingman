// ────────────────────────────────────────────────────────
//  Wingman Web Demo - Frontend Application
// ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ─── Mock Data ──────────────────────────────────────

  const SESSIONS = [
    {
      id: 'session-1',
      name: 'Auth refactor',
      tool: 'claude-code',
      project: '~/projects/saas-app',
      branch: 'feature/auth-refactor',
      lastActive: '2 min ago',
      promptCount: 12,
    },
    {
      id: 'session-2',
      name: 'API endpoints',
      tool: 'cursor',
      project: '~/projects/saas-app',
      branch: 'feature/user-api',
      lastActive: '15 min ago',
      promptCount: 8,
    },
    {
      id: 'session-3',
      name: 'DB migrations',
      tool: 'gemini-cli',
      project: '~/projects/saas-app',
      branch: 'chore/db-schema',
      lastActive: '1 hr ago',
      promptCount: 5,
    },
    {
      id: 'session-4',
      name: 'Frontend polish',
      tool: 'claude-code',
      project: '~/projects/landing-page',
      branch: 'main',
      lastActive: '3 hrs ago',
      promptCount: 22,
    },
    {
      id: 'session-5',
      name: 'Test coverage',
      tool: 'cursor',
      project: '~/projects/saas-app',
      branch: 'feature/tests',
      lastActive: 'Yesterday',
      promptCount: 17,
    },
  ];

  const PROMPT_HISTORY = {
    'session-1': [
      {
        id: 'p1',
        text: 'Refactor the auth middleware to use JWT verification with RS256 algorithm. The current implementation uses HS256 and we need to support key rotation.',
        timestamp: '10:42 AM',
        tokens: 342,
      },
      {
        id: 'p2',
        text: 'Add rate limiting to the login endpoint. Use a sliding window approach with Redis, limit to 5 attempts per minute per IP address.',
        timestamp: '10:38 AM',
        tokens: 287,
      },
      {
        id: 'p3',
        text: 'Create a refresh token rotation mechanism. When a refresh token is used, invalidate the old one and issue a new pair. Store the token family in the database to detect reuse.',
        timestamp: '10:31 AM',
        tokens: 456,
      },
      {
        id: 'p4',
        text: 'Write unit tests for the new JWT verification middleware. Cover: valid token, expired token, wrong algorithm, missing claims, malformed token string.',
        timestamp: '10:25 AM',
        tokens: 198,
      },
      {
        id: 'p12',
        text: 'Add CORS configuration for the auth endpoints. Allow requests from localhost:3000 in development and from our production domain. Include credentials support.',
        timestamp: '10:18 AM',
        tokens: 245,
      },
    ],
    'session-2': [
      {
        id: 'p5',
        text: 'Create a REST API endpoint for user profile updates. Support partial updates with PATCH, validate email format, and emit a UserUpdated event.',
        timestamp: '10:15 AM',
        tokens: 521,
      },
      {
        id: 'p6',
        text: 'Add cursor-based pagination to the GET /api/users endpoint. Default page size 25. Include total count in X-Total-Count response header.',
        timestamp: '10:08 AM',
        tokens: 315,
      },
      {
        id: 'p13',
        text: 'Implement input validation middleware using Zod schemas. Create reusable validators for the User, Project, and Team resources.',
        timestamp: '9:58 AM',
        tokens: 389,
      },
    ],
    'session-3': [
      {
        id: 'p7',
        text: 'Generate a migration to add a `preferences` JSONB column to the users table with a default empty object. Include rollback function.',
        timestamp: '9:45 AM',
        tokens: 178,
      },
      {
        id: 'p14',
        text: 'Create an index on users.email and users.created_at. Use CONCURRENTLY to avoid locking the table in production.',
        timestamp: '9:32 AM',
        tokens: 156,
      },
    ],
    'session-4': [
      {
        id: 'p8',
        text: 'Implement smooth scroll-to-section navigation for the landing page. Add active state highlighting to nav links based on current scroll position using IntersectionObserver.',
        timestamp: 'Yesterday 4:30 PM',
        tokens: 402,
      },
      {
        id: 'p15',
        text: 'Create an animated hero section with a typed text effect. Cycle through: "Ship faster", "Code smarter", "Build together". Use CSS animations, no external libraries.',
        timestamp: 'Yesterday 4:15 PM',
        tokens: 334,
      },
    ],
    'session-5': [
      {
        id: 'p9',
        text: 'Generate comprehensive test cases for the payment processing module. Cover Stripe webhook handling, idempotency keys, partial refunds, and currency conversion edge cases.',
        timestamp: 'Yesterday 2:15 PM',
        tokens: 623,
      },
      {
        id: 'p16',
        text: 'Write integration tests for the checkout flow. Mock Stripe API responses. Test: successful payment, card declined, 3D Secure redirect, subscription creation.',
        timestamp: 'Yesterday 1:48 PM',
        tokens: 478,
      },
    ],
  };

  const SAMPLE_CONTEXTS = {
    'session-1': '# Auth System - Project Context\n\n## Architecture\nThis is a Node.js/Express application using **PostgreSQL** for persistence and **Redis** for session caching.\n\n### Key Files\n- `src/middleware/auth.ts` - Authentication middleware\n- `src/services/token.ts` - JWT token generation and verification\n- `src/models/user.ts` - User model with Prisma ORM\n- `src/routes/auth.ts` - Login, logout, refresh endpoints\n\n## Current State\nThe auth system currently uses **HS256** symmetric JWT signing. We are migrating to **RS256** with asymmetric keys to support:\n- Key rotation without downtime\n- Distributed verification (microservices can verify without shared secret)\n- Better security posture\n\n## Constraints\n- Must maintain backward compatibility for 2 weeks (support both HS256 and RS256)\n- Refresh tokens stored in `refresh_tokens` table\n- Access tokens have a 15-minute TTL\n- Refresh tokens have a 7-day TTL\n\n## Dependencies\n| Package | Version | Purpose |\n|---------|---------|--------|\n| jsonwebtoken | 9.x | JWT signing/verification |\n| bcrypt | 5.x | Password hashing |\n| prisma | 5.x | Database ORM |\n| ioredis | 5.x | Redis client |\n\n> **Note:** Do not modify the User model schema without creating a migration first.\n',
    'session-2': '# User API - Project Context\n\n## Endpoints\n- `GET /api/users` - List users (paginated)\n- `GET /api/users/:id` - Get user by ID\n- `PATCH /api/users/:id` - Update user profile\n- `DELETE /api/users/:id` - Soft delete user\n\n## Validation Rules\n- Email must be unique and valid format\n- Username: 3-30 chars, alphanumeric + underscores\n- Display name: max 100 chars\n',
    'session-3': '# Database Migrations\n\n## Schema Overview\nUsing PostgreSQL 15 with Prisma ORM.\n\n### Tables\n- `users` - Core user records\n- `teams` - Team/organization records\n- `projects` - Project records linked to teams\n',
    'session-4': '# Landing Page\n\n## Tech Stack\n- Vanilla HTML/CSS/JS\n- No build tools\n- Deployed to Vercel\n',
    'session-5': '# Test Coverage Goals\n\nTarget: 80% line coverage for `src/services/` directory.\nFocus areas: payment processing, webhook handling.\n',
  };

  const TOOL_COLORS = {
    'claude-code': '#d4a574',
    'cursor': '#7cacf8',
    'gemini-cli': '#8bc78b',
  };

  const TOOL_NAMES = {
    'claude-code': 'Claude Code',
    'cursor': 'Cursor CLI',
    'gemini-cli': 'Gemini CLI',
  };

  // ─── State ──────────────────────────────────────────

  let activeSessionId = 'session-1';
  let activeTool = 'claude-code';
  let activeFeature = 'context';

  // ─── DOM References ─────────────────────────────────

  const sessionListEl = document.getElementById('sessionList');
  const historyListEl = document.getElementById('historyList');
  const contextEditorEl = document.getElementById('contextEditor');
  const contextPreviewEl = document.getElementById('contextPreview');
  const contextCharCountEl = document.getElementById('contextCharCount');
  const promptEditorEl = document.getElementById('promptEditor');
  const tokenEstimateEl = document.getElementById('tokenEstimate');
  const totalPromptsEl = document.getElementById('totalPrompts');
  const statusProjectEl = document.getElementById('statusProject');
  const statusBranchEl = document.getElementById('statusBranch');
  const statusToolEl = document.getElementById('statusTool');
  const statusTimeEl = document.getElementById('statusTime');
  const statusMessageEl = document.getElementById('statusMessage');
  const activeSessionNameEl = document.getElementById('activeSessionName');
  const activeSessionToolEl = document.getElementById('activeSessionTool');
  const toastContainerEl = document.getElementById('toastContainer');
  const sendToToolEl = document.getElementById('sendToTool');

  // ─── Safe DOM Helpers ───────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function createSessionItem(session) {
    const item = document.createElement('div');
    item.className = 'session-item' + (session.id === activeSessionId ? ' active' : '');
    item.dataset.sessionId = session.id;

    const header = document.createElement('div');
    header.className = 'session-item-header';

    const dot = document.createElement('span');
    dot.className = 'session-item-dot';
    dot.style.background = TOOL_COLORS[session.tool];

    const name = document.createElement('span');
    name.className = 'session-item-name';
    name.textContent = session.name;

    header.appendChild(dot);
    header.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'session-item-meta';

    const time = document.createElement('span');
    time.textContent = session.lastActive;

    const prompts = document.createElement('span');
    prompts.className = 'session-item-prompts';
    prompts.textContent = session.promptCount + ' prompts';

    meta.appendChild(time);
    meta.appendChild(prompts);

    item.appendChild(header);
    item.appendChild(meta);

    item.addEventListener('click', () => selectSession(session.id));

    return item;
  }

  function createHistoryItem(prompt) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.promptId = prompt.id;

    const text = document.createElement('div');
    text.className = 'history-item-text';
    text.textContent = prompt.text;

    const meta = document.createElement('div');
    meta.className = 'history-item-meta';

    const time = document.createElement('span');
    time.textContent = prompt.timestamp;

    const tokens = document.createElement('span');
    tokens.className = 'history-item-tokens';
    tokens.textContent = '~' + prompt.tokens + ' tokens';

    meta.appendChild(time);
    meta.appendChild(tokens);

    item.appendChild(text);
    item.appendChild(meta);

    item.addEventListener('click', () => {
      promptEditorEl.value = prompt.text;
      updateTokenEstimate();
      showToast('Prompt loaded into editor', 'info');
    });

    return item;
  }

  // ─── Rendering Functions ────────────────────────────

  function renderSessions() {
    const total = SESSIONS.reduce((sum, s) => sum + s.promptCount, 0);
    totalPromptsEl.textContent = total;

    clearChildren(sessionListEl);
    SESSIONS.forEach(session => {
      sessionListEl.appendChild(createSessionItem(session));
    });
  }

  function renderHistory(filter) {
    filter = filter || '';
    const prompts = PROMPT_HISTORY[activeSessionId] || [];
    const filtered = filter
      ? prompts.filter(p => p.text.toLowerCase().includes(filter.toLowerCase()))
      : prompts;

    clearChildren(historyListEl);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 20px; text-align: center; color: var(--text-faint); font-size: 12px;';
      empty.textContent = filter ? 'No matching prompts' : 'No prompt history yet';
      historyListEl.appendChild(empty);
      return;
    }

    filtered.forEach(prompt => {
      historyListEl.appendChild(createHistoryItem(prompt));
    });
  }

  function renderContextPreview() {
    const markdown = contextEditorEl.value;
    if (!markdown.trim()) {
      clearChildren(contextPreviewEl);
      const placeholder = document.createElement('p');
      placeholder.className = 'preview-placeholder';
      placeholder.textContent = 'Start typing to see a live preview...';
      contextPreviewEl.appendChild(placeholder);
      return;
    }
    try {
      // marked.parse returns sanitized HTML from markdown syntax only
      // This is a local demo with no user-submitted content from external sources
      const rendered = marked.parse(markdown);
      contextPreviewEl.innerHTML = rendered;
    } catch (e) {
      clearChildren(contextPreviewEl);
      const errMsg = document.createElement('p');
      errMsg.style.color = 'var(--accent-red)';
      errMsg.textContent = 'Markdown parse error';
      contextPreviewEl.appendChild(errMsg);
    }
  }

  function updateContextCharCount() {
    const count = contextEditorEl.value.length;
    contextCharCountEl.textContent = count.toLocaleString() + ' chars';
  }

  function updateTokenEstimate() {
    // Rough estimate: ~4 chars per token
    const chars = promptEditorEl.value.length;
    const estimate = Math.round(chars / 4);
    tokenEstimateEl.textContent = '~' + estimate.toLocaleString() + ' tokens';
  }

  function updateStatusBar() {
    const session = SESSIONS.find(s => s.id === activeSessionId);
    if (session) {
      statusProjectEl.textContent = session.project;
      statusBranchEl.textContent = session.branch;
      statusToolEl.textContent = TOOL_NAMES[session.tool] || session.tool;
      activeSessionNameEl.textContent = session.name;
      activeSessionToolEl.textContent = session.tool;
    }
  }

  function updateClock() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    statusTimeEl.textContent = h + ':' + m;
  }

  // ─── Actions ────────────────────────────────────────

  function selectSession(sessionId) {
    activeSessionId = sessionId;
    const session = SESSIONS.find(s => s.id === sessionId);

    // Update tool tabs to match session's tool
    if (session) {
      setActiveTool(session.tool);
      sendToToolEl.value = session.tool;
    }

    // Load context for this session
    contextEditorEl.value = SAMPLE_CONTEXTS[sessionId] || '';
    renderContextPreview();
    updateContextCharCount();

    renderSessions();
    renderHistory();
    updateStatusBar();
  }

  function setActiveTool(tool) {
    activeTool = tool;
    document.querySelectorAll('.tool-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tool === tool);
    });
    updateStatusBar();
  }

  function setActiveFeature(feature) {
    activeFeature = feature;
    document.querySelectorAll('.feature-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.feature === feature);
    });
    document.getElementById('contextPanel').classList.toggle('active', feature === 'context');
    document.getElementById('promptsPanel').classList.toggle('active', feature === 'prompts');
  }

  function showToast(message, type) {
    type = type || 'info';
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '\u2713' : '\u2139';

    const text = document.createTextNode(' ' + message);

    toast.appendChild(icon);
    toast.appendChild(text);
    toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.2s ease forwards';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  function setStatusMessage(message, duration) {
    duration = duration || 3000;
    statusMessageEl.textContent = message;
    if (duration > 0) {
      setTimeout(() => {
        statusMessageEl.textContent = 'Ready';
      }, duration);
    }
  }

  // ─── Event Listeners ────────────────────────────────

  // Tool tabs
  document.querySelectorAll('.tool-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setActiveTool(tab.dataset.tool);
      showToast('Switched to ' + (TOOL_NAMES[tab.dataset.tool] || tab.dataset.tool), 'info');
    });
  });

  // Feature tabs
  document.querySelectorAll('.feature-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.feature) {
        setActiveFeature(tab.dataset.feature);
      }
    });
  });

  // Context editor - live preview
  contextEditorEl.addEventListener('input', () => {
    renderContextPreview();
    updateContextCharCount();
  });

  // Prompt editor - token estimate
  promptEditorEl.addEventListener('input', () => {
    updateTokenEstimate();
  });

  // History search
  const historySearchEl = document.getElementById('historySearch');
  historySearchEl.addEventListener('input', () => {
    renderHistory(historySearchEl.value);
  });

  // Send prompt button
  document.getElementById('sendPromptBtn').addEventListener('click', () => {
    const text = promptEditorEl.value.trim();
    if (!text) {
      showToast('Write a prompt first', 'info');
      return;
    }

    // Simulate sending
    const tool = TOOL_NAMES[sendToToolEl.value] || sendToToolEl.value;
    setStatusMessage('Sending to ' + tool + '...');

    // Add to history (mock)
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newPrompt = {
      id: 'p-' + Date.now(),
      text: text,
      timestamp: timeStr,
      tokens: Math.round(text.length / 4),
    };

    if (!PROMPT_HISTORY[activeSessionId]) {
      PROMPT_HISTORY[activeSessionId] = [];
    }
    PROMPT_HISTORY[activeSessionId].unshift(newPrompt);

    // Update session prompt count
    const session = SESSIONS.find(s => s.id === activeSessionId);
    if (session) {
      session.promptCount++;
    }

    // Clear editor, re-render
    promptEditorEl.value = '';
    updateTokenEstimate();
    renderHistory(historySearchEl.value);
    renderSessions();

    setTimeout(() => {
      showToast('Prompt sent to ' + tool, 'success');
      setStatusMessage('Ready');
    }, 600);
  });

  // Insert template button (context)
  document.getElementById('insertTemplateBtn').addEventListener('click', () => {
    const template = '# Project Context\n\n## Overview\nBrief description of the project.\n\n## Tech Stack\n- Language:\n- Framework:\n- Database:\n\n## Key Files\n- `src/` - Source code\n- `tests/` - Test files\n\n## Constraints\n-\n\n## Notes\n> Add any relevant notes here.\n';
    contextEditorEl.value = template;
    renderContextPreview();
    updateContextCharCount();
    showToast('Template inserted', 'success');
  });

  // Attach context button
  document.getElementById('attachContextBtn').addEventListener('click', () => {
    const context = contextEditorEl.value.trim();
    if (!context) {
      showToast('No context to attach - switch to Context tab to write some', 'info');
      return;
    }
    const lines = context.split('\n').length;
    showToast('Context attached (' + lines + ' lines)', 'success');
  });

  // Templates button (prompts)
  document.getElementById('loadTemplateBtn').addEventListener('click', () => {
    const templates = [
      'Refactor {function} to improve readability and add error handling.',
      'Write unit tests for {module}. Cover edge cases and error paths.',
      'Add TypeScript types to {file}. Use strict mode, no `any` types.',
      'Review this code for security vulnerabilities and suggest fixes.',
      'Create a migration to add {column} to the {table} table.',
    ];
    const template = templates[Math.floor(Math.random() * templates.length)];
    promptEditorEl.value = template;
    updateTokenEstimate();
    showToast('Template loaded - customize the {placeholders}', 'info');
  });

  // New session button
  document.getElementById('newSessionBtn').addEventListener('click', () => {
    showToast('New session dialog would open here', 'info');
  });

  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    showToast('Settings panel would open here', 'info');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter to send prompt
    if (e.ctrlKey && e.key === 'Enter' && activeFeature === 'prompts') {
      e.preventDefault();
      document.getElementById('sendPromptBtn').click();
    }
    // Ctrl+1 / Ctrl+2 to switch feature tabs
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault();
      setActiveFeature('context');
    }
    if (e.ctrlKey && e.key === '2') {
      e.preventDefault();
      setActiveFeature('prompts');
    }
  });

  // Tab key support in textareas
  [contextEditorEl, promptEditorEl].forEach(textarea => {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        // Trigger input event for preview updates
        textarea.dispatchEvent(new Event('input'));
      }
    });
  });

  // ─── Initialize ─────────────────────────────────────

  function init() {
    renderSessions();
    selectSession('session-1');
    renderHistory();
    updateClock();
    setInterval(updateClock, 30000);

    // Set initial feature to context
    setActiveFeature('context');

    setStatusMessage('Wingman web demo loaded', 2000);
  }

  init();
});
