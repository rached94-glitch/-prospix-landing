const PLANS = {
  free:     { maxLeads: 30,  maxSearchesPerDay: 4,  credits: 15  },
  starter:  { maxLeads: 60,  maxSearchesPerDay: 10, credits: 80  },
  pro:      { maxLeads: 120, maxSearchesPerDay: 30, credits: 250 },
  business: { maxLeads: 200, maxSearchesPerDay: 20, credits: 600 },
}

const LEAD_COSTS = {
  30:  2,
  60:  4,
  120: 7,
}

// TODO: vérification plan et crédits avec Supabase
module.exports = { PLANS, LEAD_COSTS, DEFAULT_MAX_LEADS: 30 }
