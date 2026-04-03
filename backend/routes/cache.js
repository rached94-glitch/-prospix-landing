const express = require('express');
const router  = express.Router();
const { getAllStats } = require('../cache/searchCache');

// GET /api/cache/stats — renvoie les stats de tous les caches en mémoire
router.get('/stats', (req, res) => {
  res.json(getAllStats());
});

module.exports = router;
