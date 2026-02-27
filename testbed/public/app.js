// ────────────────────────────────────────────────────────
//  Wingman Web Demo — Application
//  Note: innerHTML usage with marked.parse is intentional
//  for local-only markdown preview. Production build would
//  use DOMPurify for sanitization.
// ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ─── Mock Data ──────────────────────────────────────

  const SESSIONS = [
    {
      id: 'session-1',
      name: 'Auth refactor',
      project: '~/projects/saas-app',
      lastActive: '2 min ago',
      promptCount: 12,
    },
    {
      id: 'session-2',
      name: 'API endpoints',
      project: '~/projects/saas-app',
      lastActive: '15 min ago',
      promptCount: 8,
    },
    {
      id: 'session-3',
      name: 'DB migrations',
      project: '~/projects/saas-app',
      lastActive: '1 hr ago',
      promptCount: 5,
    },
    {
      id: 'session-4',
      name: 'Frontend polish',
      project: '~/projects/landing-page',
      lastActive: '3 hrs ago',
      promptCount: 22,
    },
    {
      id: 'session-5',
      name: 'Test coverage',
      project: '~/projects/saas-app',
      lastActive: 'Yesterday',
      promptCount: 17,
    },
    {
      id: 'session-6',
      name: 'CI pipeline',
      project: '~/projects/saas-app',
      lastActive: '22 Feb 2026',
      promptCount: 9,
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
    'session-6': [
      {
        id: 'p17',
        text: 'Set up GitHub Actions workflow for running tests on every PR. Include linting, unit tests, and integration tests as separate jobs.',
        timestamp: '22 Feb 3:10 PM',
        tokens: 312,
      },
      {
        id: 'p18',
        text: 'Add a build step that generates a Docker image tagged with the commit SHA. Push to GitHub Container Registry on merge to main.',
        timestamp: '22 Feb 2:45 PM',
        tokens: 278,
      },
    ],
  };

  const SAMPLE_CONTEXTS = {
    'session-1': '# Auth System - Project Context\n\n## Architecture\nThis is a Node.js/Express application using **PostgreSQL** for persistence and **Redis** for session caching.\n\n### Key Files\n- `src/middleware/auth.ts` - Authentication middleware\n- `src/services/token.ts` - JWT token generation and verification\n- `src/models/user.ts` - User model with Prisma ORM\n- `src/routes/auth.ts` - Login, logout, refresh endpoints\n\n## Current State\nThe auth system currently uses **HS256** symmetric JWT signing. We are migrating to **RS256** with asymmetric keys to support:\n- Key rotation without downtime\n- Distributed verification (microservices can verify without shared secret)\n- Better security posture\n\n## Constraints\n- Must maintain backward compatibility for 2 weeks (support both HS256 and RS256)\n- Refresh tokens stored in `refresh_tokens` table\n- Access tokens have a 15-minute TTL\n- Refresh tokens have a 7-day TTL\n\n## Dependencies\n| Package | Version | Purpose |\n|---------|---------|--------|\n| jsonwebtoken | 9.x | JWT signing/verification |\n| bcrypt | 5.x | Password hashing |\n| prisma | 5.x | Database ORM |\n| ioredis | 5.x | Redis client |\n\n> **Note:** Do not modify the User model schema without creating a migration first.\n',
    'session-2': '# User API - Project Context\n\n## Endpoints\n- `GET /api/users` - List users (paginated)\n- `GET /api/users/:id` - Get user by ID\n- `PATCH /api/users/:id` - Update user profile\n- `DELETE /api/users/:id` - Soft delete user\n\n## Validation Rules\n- Email must be unique and valid format\n- Username: 3-30 chars, alphanumeric + underscores\n- Display name: max 100 chars\n',
    'session-3': '# Database Migrations\n\n## Schema Overview\nUsing PostgreSQL 15 with Prisma ORM.\n\n### Tables\n- `users` - Core user records\n- `teams` - Team/organization records\n- `projects` - Project records linked to teams\n',
    'session-4': '# Landing Page\n\n## Tech Stack\n- Vanilla HTML/CSS/JS\n- No build tools\n- Deployed to Vercel\n',
    'session-5': '# Test Coverage Goals\n\nTarget: 80% line coverage for `src/services/` directory.\nFocus areas: payment processing, webhook handling.\n',
    'session-6': '# CI Pipeline\n\n## Goals\n- Automated test runs on every PR\n- Docker image builds on merge to main\n- Deploy preview environments for PRs\n\n## Stack\n- GitHub Actions\n- Docker + GitHub Container Registry\n',
  };


  // ─── State ──────────────────────────────────────────

  let activeSessionId = 'session-1';
  let activeFeature = 'context';
  let activeHistoryId = null;

  // ─── DOM References ─────────────────────────────────

  const sessionListEl = document.getElementById('sessionList');
  const historyListEl = document.getElementById('historyList');
  const contextEditorEl = document.getElementById('contextEditor');
  const contextPreviewEl = document.getElementById('contextPreview');
  const contextCharCountEl = document.getElementById('contextCharCount');
  const contextTokenCountEl = document.getElementById('contextTokenCount');
  const promptEditorEl = document.getElementById('promptEditor');
  const promptCharCountEl = document.getElementById('promptCharCount');
  const tokenEstimateEl = document.getElementById('tokenEstimate');
  const totalPromptsEl = document.getElementById('totalPrompts');
  const statusProjectEl = document.getElementById('statusProject');
  const statusMessageEl = document.getElementById('statusMessage');
  const headerSessionNameEl = document.getElementById('headerSessionName');
  const headerSessionDotEl = document.getElementById('headerSessionDot');
  const contextActionsEl = document.getElementById('contextActions');
  const toastContainerEl = document.getElementById('toastContainer');

  // ─── Helpers ──────────────────────────────────────

  let contextDirty = false;

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // ─── Session List ─────────────────────────────────

  function createSessionItem(session) {
    const item = document.createElement('div');
    item.className = 'session-item' + (session.id === activeSessionId ? ' active' : '');
    item.dataset.sessionId = session.id;

    const header = document.createElement('div');
    header.className = 'session-item-header';

    const dot = document.createElement('span');
    dot.className = 'session-item-dot';
    dot.style.background = 'var(--primary)';

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

  function renderSessions() {
    const total = SESSIONS.reduce((sum, s) => sum + s.promptCount, 0);
    totalPromptsEl.textContent = total;
    clearChildren(sessionListEl);
    SESSIONS.forEach(session => {
      sessionListEl.appendChild(createSessionItem(session));
    });
  }

  // ─── History List ─────────────────────────────────

  function createHistoryItem(prompt) {
    const item = document.createElement('div');
    item.className = 'history-item' + (prompt.id === activeHistoryId ? ' active' : '');
    item.dataset.promptId = prompt.id;

    const text = document.createElement('div');
    text.className = 'history-item-text';
    text.textContent = prompt.text;

    const meta = document.createElement('div');
    meta.className = 'history-item-meta';

    const time = document.createElement('span');
    time.textContent = prompt.timestamp;

    meta.appendChild(time);

    item.appendChild(text);
    item.appendChild(meta);

    item.addEventListener('click', () => {
      activeHistoryId = prompt.id;
      promptEditorEl.value = prompt.text;
      updatePromptCounts();
      renderHistory(document.getElementById('historySearch').value);
      showToast('Prompt loaded into editor', 'info');
    });

    return item;
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
      empty.style.cssText = 'padding: 24px 12px; text-align: center; color: var(--text-4); font-size: 12px;';
      empty.textContent = filter ? 'No matching prompts' : 'No prompt history yet';
      historyListEl.appendChild(empty);
      return;
    }

    filtered.forEach(prompt => {
      historyListEl.appendChild(createHistoryItem(prompt));
    });
  }

  // ─── Context Preview ──────────────────────────────

  function renderContextPreview() {
    const markdown = contextEditorEl.value;
    if (!markdown.trim()) {
      clearChildren(contextPreviewEl);
      const placeholder = document.createElement('p');
      placeholder.className = 'preview-empty';
      placeholder.textContent = 'Start typing to see a live preview...';
      contextPreviewEl.appendChild(placeholder);
      return;
    }
    try {
      // Local-only demo: markdown is user's own content, not external input.
      // Production would use DOMPurify here.
      const rendered = marked.parse(markdown);
      contextPreviewEl.innerHTML = rendered;  // eslint-disable-line no-unsanitized/property
    } catch (e) {
      clearChildren(contextPreviewEl);
      const errMsg = document.createElement('p');
      errMsg.style.color = 'var(--danger)';
      errMsg.textContent = 'Markdown parse error';
      contextPreviewEl.appendChild(errMsg);
    }
  }

  function updateContextCounts() {
    const count = contextEditorEl.value.length;
    contextCharCountEl.textContent = count.toLocaleString() + ' chars';
    contextTokenCountEl.textContent = '~' + Math.round(count / 4).toLocaleString() + ' tokens';
  }

  function updatePromptCounts() {
    const chars = promptEditorEl.value.length;
    promptCharCountEl.textContent = chars.toLocaleString() + ' chars';
    tokenEstimateEl.textContent = '~' + Math.round(chars / 4).toLocaleString() + ' tokens';
  }

  // ─── Status / Header Updates ──────────────────────

  function updateUI() {
    const session = SESSIONS.find(s => s.id === activeSessionId);
    if (!session) return;

    statusProjectEl.textContent = session.project;
    headerSessionNameEl.textContent = session.name;
    headerSessionDotEl.style.background = 'var(--success)';
    headerSessionDotEl.style.boxShadow = '0 0 6px rgba(139, 199, 139, 0.4)';

    // Update sidebar project indicator
    const sidebarProjectEl = document.getElementById('sidebarProject');
    if (sidebarProjectEl) sidebarProjectEl.textContent = session.project;
  }

  // ─── Actions ──────────────────────────────────────

  function selectSession(sessionId) {
    activeSessionId = sessionId;
    activeHistoryId = null;

    contextEditorEl.value = SAMPLE_CONTEXTS[sessionId] || '';
    renderContextPreview();
    updateContextCounts();
    contextDirty = false;
    contextActionsEl.classList.remove('visible');

    promptEditorEl.value = '';
    updatePromptCounts();

    renderSessions();
    renderHistory();
    updateUI();
  }

  function setActiveFeature(feature) {
    activeFeature = feature;
    document.querySelectorAll('.feature-nav-btn').forEach(tab => {
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
      setTimeout(() => { statusMessageEl.textContent = 'Ready'; }, duration);
    }
  }

  // ─── Event Listeners ──────────────────────────────

  // Feature nav
  document.querySelectorAll('.feature-nav-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.feature) setActiveFeature(tab.dataset.feature);
    });
  });

  // Context editor — show Save button when dirty
  contextEditorEl.addEventListener('input', () => {
    renderContextPreview();
    updateContextCounts();
    if (!contextDirty) {
      contextDirty = true;
      contextActionsEl.classList.add('visible');
    }
  });

  // Save context button
  document.getElementById('saveContextBtn').addEventListener('click', () => {
    // In production this writes to .wingman/context.md
    contextDirty = false;
    contextActionsEl.classList.remove('visible');
    showToast('Context saved', 'success');
  });

  // Prompt editor
  promptEditorEl.addEventListener('input', () => {
    updatePromptCounts();
  });

  // History search
  const historySearchEl = document.getElementById('historySearch');
  historySearchEl.addEventListener('input', () => {
    renderHistory(historySearchEl.value);
  });

  // Save prompt
  document.getElementById('sendPromptBtn').addEventListener('click', () => {
    const text = promptEditorEl.value.trim();
    if (!text) {
      showToast('Write a prompt first', 'info');
      return;
    }

    setStatusMessage('Saving prompt...');

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

    const session = SESSIONS.find(s => s.id === activeSessionId);
    if (session) session.promptCount++;

    promptEditorEl.value = '';
    activeHistoryId = newPrompt.id;
    updatePromptCounts();
    renderHistory(historySearchEl.value);
    renderSessions();

    setTimeout(() => {
      showToast('Prompt saved', 'success');
      setStatusMessage('Ready');
    }, 400);
  });

  // Clear prompt
  document.getElementById('clearPromptBtn').addEventListener('click', () => {
    promptEditorEl.value = '';
    activeHistoryId = null;
    updatePromptCounts();
    renderHistory(historySearchEl.value);
  });

  // Template button
  document.getElementById('insertTemplateBtn').addEventListener('click', () => {
    const template = '# Project Context\n\n## Overview\nBrief description of the project.\n\n## Tech Stack\n- Language:\n- Framework:\n- Database:\n\n## Key Files\n- `src/` - Source code\n- `tests/` - Test files\n\n## Constraints\n-\n\n## Notes\n> Add any relevant notes here.\n';
    contextEditorEl.value = template;
    renderContextPreview();
    updateContextCounts();
    showToast('Template inserted', 'success');
  });

  // New session
  document.getElementById('newSessionBtn').addEventListener('click', () => {
    showToast('New session dialog would open here', 'info');
  });

  // Menu toggle
  const menuBtn = document.getElementById('menuBtn');
  const headerMenu = document.getElementById('headerMenu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headerMenu.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    headerMenu.classList.remove('open');
  });

  headerMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.getElementById('menuSettings').addEventListener('click', () => {
    headerMenu.classList.remove('open');
    showToast('Settings panel would open here', 'info');
  });

  document.getElementById('menuHelp').addEventListener('click', () => {
    headerMenu.classList.remove('open');
    showToast('Help panel would open here', 'info');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter' && activeFeature === 'prompts') {
      e.preventDefault();
      document.getElementById('sendPromptBtn').click();
    }
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault();
      setActiveFeature('context');
    }
    if (e.ctrlKey && e.key === '2') {
      e.preventDefault();
      setActiveFeature('prompts');
    }
  });

  // Tab key in textareas
  [contextEditorEl, promptEditorEl].forEach(textarea => {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input'));
      }
    });
  });

  // ─── Initialize ───────────────────────────────────

  function init() {
    renderSessions();
    selectSession('session-1');
    renderHistory();
    setActiveFeature('context');
    setStatusMessage('Wingman loaded', 2000);
  }

  init();
});
