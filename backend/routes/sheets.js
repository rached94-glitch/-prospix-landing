const express = require('express')
const router  = express.Router()
const { appendLead } = require('../services/googleSheets')

router.post('/lead', async (req, res) => {
  try {
    const { lead } = req.body
    if (!lead) return res.status(400).json({ error: 'Lead manquant' })

    await appendLead(lead)
    res.json({ success: true, message: 'Lead sauvegardé dans Sheets' })
  } catch (e) {
    console.error('Sheets error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
