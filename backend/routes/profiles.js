const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '../data/scoringProfiles.json');

function readProfiles(res) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read profiles data', details: err.message });
    return null;
  }
}

function writeProfiles(data, res) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    res.status(500).json({ error: 'Failed to write profiles data', details: err.message });
    return false;
  }
}

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET /api/profiles
router.get('/', (req, res) => {
  console.log('[GET /api/profiles] called');
  const data = readProfiles(res);
  if (!data) return;
  res.json({ profiles: data.profiles });
});

// POST /api/profiles
router.post('/', (req, res) => {
  console.log('[POST /api/profiles] body:', JSON.stringify(req.body));
  const { name, weights } = req.body;

  // Validate name
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: '`name` must be a non-empty string' });
  }

  // Validate weights object and required keys
  const requiredWeightKeys = ['googleRating', 'reviewVolume', 'digitalPresence', 'opportunity'];
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    return res.status(400).json({ error: '`weights` must be an object with keys: ' + requiredWeightKeys.join(', ') });
  }
  for (const key of requiredWeightKeys) {
    if (!(key in weights)) {
      return res.status(400).json({ error: `\`weights\` is missing required key: ${key}` });
    }
    if (typeof weights[key] !== 'number') {
      return res.status(400).json({ error: `\`weights.${key}\` must be a number` });
    }
  }
  const weightSum = requiredWeightKeys.reduce((sum, key) => sum + weights[key], 0);
  if (Math.abs(weightSum - 100) > 0.01) {
    return res.status(400).json({ error: `Weight values must sum to exactly 100 (got ${weightSum})` });
  }

  const data = readProfiles(res);
  if (!data) return;

  // Generate ID and ensure uniqueness
  let baseId = generateId(name);
  if (baseId === '') {
    return res.status(400).json({ error: '`name` produced an empty id — use at least one alphanumeric character' });
  }
  let candidateId = baseId;
  let suffix = 2;
  while (data.profiles.some((p) => p.id === candidateId)) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const profile = {
    id: candidateId,
    name,
    isPreset: false,
    weights,
  };

  data.profiles.push(profile);
  const written = writeProfiles(data, res);
  if (!written) return;

  res.status(201).json({ profile });
});

// PUT /api/profiles/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, weights } = req.body;
  const data = readProfiles(res);
  if (!data) return;

  const index = data.profiles.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const profile = data.profiles[index];

  if (profile.isPreset === true) {
    return res.status(403).json({ error: 'Cannot edit preset profiles' });
  }

  if (weights !== undefined) {
    const requiredWeightKeys = ['googleRating', 'reviewVolume', 'digitalPresence', 'opportunity'];
    if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
      return res.status(400).json({ error: '`weights` must be an object with keys: ' + requiredWeightKeys.join(', ') });
    }
    for (const key of requiredWeightKeys) {
      if (!(key in weights)) {
        return res.status(400).json({ error: `\`weights\` is missing required key: ${key}` });
      }
      if (typeof weights[key] !== 'number') {
        return res.status(400).json({ error: `\`weights.${key}\` must be a number` });
      }
    }
    const weightSum = requiredWeightKeys.reduce((sum, key) => sum + weights[key], 0);
    if (Math.abs(weightSum - 100) > 0.01) {
      return res.status(400).json({ error: `Weight values must sum to exactly 100 (got ${weightSum})` });
    }
  }

  if (name !== undefined) profile.name = name;
  if (weights !== undefined) profile.weights = weights;

  data.profiles[index] = profile;
  const written = writeProfiles(data, res);
  if (!written) return;

  res.json({ profile });
});

// DELETE /api/profiles/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const data = readProfiles(res);
  if (!data) return;

  const index = data.profiles.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  if (data.profiles[index].isPreset === true) {
    return res.status(403).json({ error: 'Cannot delete preset profiles' });
  }

  data.profiles.splice(index, 1);
  const written = writeProfiles(data, res);
  if (!written) return;

  res.json({ ok: true });
});

module.exports = router;
