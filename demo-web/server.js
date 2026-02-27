const express = require('express');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Render markdown to HTML (server-side rendering option)
app.post('/api/render-markdown', (req, res) => {
  const { markdown } = req.body;
  if (!markdown) {
    return res.json({ html: '' });
  }
  try {
    const html = marked(markdown);
    res.json({ html });
  } catch (err) {
    res.status(400).json({ error: 'Failed to render markdown' });
  }
});

// API: Mock sessions data
app.get('/api/sessions', (req, res) => {
  res.json([
    {
      id: 'session-1',
      name: 'Auth refactor',
      tool: 'claude-code',
      project: '~/projects/saas-app',
      lastActive: '2 min ago',
      promptCount: 12,
    },
    {
      id: 'session-2',
      name: 'API endpoints',
      tool: 'cursor',
      project: '~/projects/saas-app',
      lastActive: '15 min ago',
      promptCount: 8,
    },
    {
      id: 'session-3',
      name: 'DB migrations',
      tool: 'gemini-cli',
      project: '~/projects/saas-app',
      lastActive: '1 hr ago',
      promptCount: 5,
    },
    {
      id: 'session-4',
      name: 'Frontend polish',
      tool: 'claude-code',
      project: '~/projects/landing-page',
      lastActive: '3 hrs ago',
      promptCount: 22,
    },
    {
      id: 'session-5',
      name: 'Test coverage',
      tool: 'cursor',
      project: '~/projects/saas-app',
      lastActive: 'Yesterday',
      promptCount: 17,
    },
  ]);
});

// API: Mock prompt history
app.get('/api/prompts/:sessionId', (req, res) => {
  const prompts = {
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
        text: 'Create a refresh token rotation mechanism. When a refresh token is used, invalidate the old one and issue a new pair. Store the token family in the database.',
        timestamp: '10:31 AM',
        tokens: 456,
      },
      {
        id: 'p4',
        text: 'Write unit tests for the new JWT verification middleware. Cover: valid token, expired token, wrong algorithm, missing claims, malformed token.',
        timestamp: '10:25 AM',
        tokens: 198,
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
        text: 'Add pagination to the GET /api/users endpoint. Use cursor-based pagination with a default page size of 25. Include total count in response headers.',
        timestamp: '10:08 AM',
        tokens: 315,
      },
    ],
    'session-3': [
      {
        id: 'p7',
        text: 'Generate a migration to add a `preferences` JSONB column to the users table with a default empty object. Include rollback.',
        timestamp: '9:45 AM',
        tokens: 178,
      },
    ],
    'session-4': [
      {
        id: 'p8',
        text: 'Implement a smooth scroll-to-section navigation for the landing page. Add active state highlighting to the nav links based on scroll position.',
        timestamp: 'Yesterday 4:30 PM',
        tokens: 402,
      },
    ],
    'session-5': [
      {
        id: 'p9',
        text: 'Generate test cases for the payment processing module. Cover Stripe webhook handling, idempotency, and partial refunds.',
        timestamp: 'Yesterday 2:15 PM',
        tokens: 623,
      },
    ],
  };
  res.json(prompts[req.params.sessionId] || []);
});

app.listen(PORT, () => {
  console.log(`\n  Wingman Web Demo`);
  console.log(`  ────────────────────────`);
  console.log(`  Running at http://localhost:${PORT}`);
  console.log(`  Press Ctrl+C to stop\n`);
});
