#!/usr/bin/env node
'use strict';

// Wingman entry point — invoked by `npx wingman` or `wingman` (global install)
// All logic lives in server.js; this file just ensures the correct working directory
// and then boots the server.

require('../server.js');
