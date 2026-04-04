require('dotenv').config();
require('./utils/validateEnv')();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

// ── Capture tout crash silencieux ─────────────────────────────────────────────
process.on('uncaughtException',  err => console.error('[CRASH] uncaughtException:',  err))
process.on('unhandledRejection', err => console.error('[CRASH] unhandledRejection:', err))

const leadsRoutes  = require('./routes/leads');
const exportRoutes = require('./routes/export');
const sheetsRoutes = require('./routes/sheets');
const profilesRoutes = require('./routes/profiles');
const cacheRoutes  = require('./routes/cache');

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] }));
app.use(express.json());

app.use('/api/leads', leadsRoutes);
app.use('/api/leads', require('./routes/visualAnalysis'));
app.use('/api/export', exportRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/cache', cacheRoutes);
console.log('[server] Routes mounted: /api/leads, /api/export, /api/sheets, /api/profiles, /api/leads/visual-analysis, /api/cache');

app.get('/', (req, res) => {
  res.json({ status: 'LeadGen API running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
