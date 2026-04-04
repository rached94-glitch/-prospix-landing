#!/usr/bin/env bash
# ── LeadGen Pro — smoke tests des routes principales ───────────────────────���─
# Usage : bash tests/test-routes.sh
# Depuis la racine backend ou n'importe où (le chemin est relatif au script)

BASE="http://localhost:3001"
PASS=0
FAIL=0

# ── Couleurs ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
pass() { echo -e "  ${GREEN}✔ PASS${RESET}  $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✘ FAIL${RESET}  $1"; ((FAIL++)); }

# Vérifie qu'une chaîne JSON contient une clé ou valeur
json_has() {
  echo "$1" | grep -q "$2"
}

# ── 0. Vérification que le backend tourne ─────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}LeadGen Pro — smoke tests${RESET}"
echo -e "${CYAN}──────────────────────────────────────────${RESET}"
echo -e "Base URL : ${BASE}"
echo ""

echo -e "${BOLD}[0] Disponibilité du backend${RESET}"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${BASE}/")
if [ "$HEALTH" = "200" ]; then
  pass "GET / → backend opérationnel"
else
  echo -e "  ${RED}✘ FATAL${RESET}  Backend inaccessible sur ${BASE} (HTTP ${HEALTH})"
  echo ""
  echo -e "${RED}Arrêt des tests — lancez le backend avec : npm run dev${RESET}"
  exit 1
fi

echo ""

# ── 1. GET /api/profiles ──────────────────────────────────────────────────────
echo -e "${BOLD}[1] GET /api/profiles${RESET}"
R=$(curl -s -w "\n%{http_code}" --max-time 5 "${BASE}/api/profiles")
BODY=$(echo "$R" | head -n -1)
STATUS=$(echo "$R" | tail -n 1)

if [ "$STATUS" = "200" ] && (json_has "$BODY" '"id"' || json_has "$BODY" '\['); then
  pass "status 200 + JSON array reçu"
else
  fail "attendu 200+array — reçu HTTP ${STATUS} | body: ${BODY:0:120}"
fi

echo ""

# ── 2. GET /api/cache/stats ───────────────────────────────────────────────────
echo -e "${BOLD}[2] GET /api/cache/stats${RESET}"
R=$(curl -s -w "\n%{http_code}" --max-time 5 "${BASE}/api/cache/stats")
BODY=$(echo "$R" | head -n -1)
STATUS=$(echo "$R" | tail -n 1)

if [ "$STATUS" = "200" ] && (json_has "$BODY" 'hits' || json_has "$BODY" 'entries' || json_has "$BODY" '\[' || json_has "$BODY" '\{'); then
  pass "status 200 + JSON object reçu"
else
  fail "attendu 200+object — reçu HTTP ${STATUS} | body: ${BODY:0:120}"
fi

echo ""

# ── 3. POST /api/leads/search/stream — body valide ───────────────────────────
echo -e "${BOLD}[3] POST /api/leads/search/stream — body valide${RESET}"
# SSE : on lit juste le début (--max-time 4) et vérifie status 200 + data:
R=$(curl -s -o /tmp/sse_valid.txt -w "%{http_code}" --max-time 4 \
  -X POST "${BASE}/api/leads/search/stream" \
  -H "Content-Type: application/json" \
  -d '{"lat":48.58,"lng":7.75,"radius":5000,"keywords":["restaurant"],"domain":"restaurant"}')
SSE_BODY=$(cat /tmp/sse_valid.txt 2>/dev/null)

if [ "$R" = "200" ] && (echo "$SSE_BODY" | grep -q "^data:"); then
  pass "status 200 + événement SSE reçu"
elif [ "$R" = "200" ]; then
  pass "status 200 (stream ouvert — pas d'événement dans la fenêtre de 4s)"
else
  fail "attendu 200 — reçu HTTP ${R} | body: ${SSE_BODY:0:120}"
fi

echo ""

# ── 4. POST /api/leads/search/stream — body invalide ─────────────────────────
echo -e "${BOLD}[4] POST /api/leads/search/stream — body invalide${RESET}"
R=$(curl -s -o /tmp/sse_invalid.txt -w "%{http_code}" --max-time 4 \
  -X POST "${BASE}/api/leads/search/stream" \
  -H "Content-Type: application/json" \
  -d '{"lat":"abc"}')
SSE_BODY=$(cat /tmp/sse_invalid.txt 2>/dev/null)

# La route SSE renvoie toujours 200 mais doit envoyer un event {type:"error"}
# OU la validation globale renvoie 400. Les deux sont acceptables.
if [ "$R" = "200" ] && echo "$SSE_BODY" | grep -q '"type":"error"'; then
  pass "status 200 + event {type:\"error\"} reçu (validation SSE)"
elif [ "$R" = "400" ]; then
  pass "status 400 reçu (validation HTTP)"
else
  fail "attendu erreur propre — reçu HTTP ${R} | body: ${SSE_BODY:0:200}"
fi

echo ""

# ── 5. POST /api/leads/analyze/INVALID — placeId invalide ────────────────────
echo -e "${BOLD}[5] POST /api/leads/analyze/INVALID — placeId invalide${RESET}"
R=$(curl -s -w "\n%{http_code}" --max-time 5 \
  -X POST "${BASE}/api/leads/analyze/INVALID" \
  -H "Content-Type: application/json" \
  -d '{"reviews":[{"text":"super","rating":5}],"businessName":"Test"}')
BODY=$(echo "$R" | head -n -1)
STATUS=$(echo "$R" | tail -n 1)

if [ "$STATUS" = "400" ] && json_has "$BODY" '"error"'; then
  pass "status 400 + {\"error\":...} reçu"
else
  fail "attendu 400+error — reçu HTTP ${STATUS} | body: ${BODY:0:120}"
fi

echo ""

# ── 6. POST /api/leads/analyze/ChIJfake123 — placeId valide, données vides ────
echo -e "${BOLD}[6] POST /api/leads/analyze/ChIJfake123 — corps sans reviews${RESET}"
R=$(curl -s -w "\n%{http_code}" --max-time 5 \
  -X POST "${BASE}/api/leads/analyze/ChIJfake123" \
  -H "Content-Type: application/json" \
  -d '{"reviews":[],"businessName":"Test"}')
BODY=$(echo "$R" | head -n -1)
STATUS=$(echo "$R" | tail -n 1)

# Doit renvoyer une erreur propre (400) — pas un crash (500 sans body ou ECONNRESET)
if [ "$STATUS" = "400" ] && json_has "$BODY" '"error"'; then
  pass "status 400 + {\"error\":...} — pas de crash serveur"
elif [ "$STATUS" = "200" ] || [ "$STATUS" = "400" ] || [ "$STATUS" = "422" ]; then
  pass "réponse gérée (HTTP ${STATUS}) — pas de crash serveur"
else
  fail "crash probable — reçu HTTP ${STATUS} | body: ${BODY:0:120}"
fi

echo ""

# ── Résumé ────────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo -e "${CYAN}──────────────────────────────────────────${RESET}"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${BOLD}${GREEN}Résultat : ${PASS}/${TOTAL} tests passés ✔${RESET}"
else
  echo -e "${BOLD}${YELLOW}Résultat : ${PASS}/${TOTAL} tests passés${RESET} — ${RED}${FAIL} échec(s)${RESET}"
fi
echo ""

# Exit code non-zéro si au moins un test a échoué
[ "$FAIL" -eq 0 ]
