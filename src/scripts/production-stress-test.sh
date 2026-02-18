#!/bin/bash
# ============================================================================
# Production Stress Test — hit live convergence endpoint for 20 tickers
# Usage: bash src/scripts/production-stress-test.sh
# ============================================================================

BASE_URL="https://temple-stuart-accounting.vercel.app/api/test/convergence"
TICKERS="AAPL NVDA TSLA JPM XOM PFE PLTR GME MSFT AMZN META GOOGL KO WMT BAC AMD COIN SOFI IWM SPY"
DELAY=4
OUTDIR="/tmp/convergence_stress_test"

mkdir -p "$OUTDIR"

echo "========================================================================================================"
echo "PRODUCTION STRESS TEST — 20 tickers, ${DELAY}s delay"
echo "Endpoint: ${BASE_URL}"
echo "========================================================================================================"
echo ""

# Arrays to collect results
declare -a RESULT_TICKER
declare -a RESULT_STATUS
declare -a RESULT_COMPOSITE
declare -a RESULT_VOL
declare -a RESULT_QUAL
declare -a RESULT_REGIME
declare -a RESULT_INFO
declare -a RESULT_STRATEGY
declare -a RESULT_GAPS
declare -a RESULT_RUNTIME
declare -a RESULT_ERROR

COUNT=0
TOTAL=0
for _ in $TICKERS; do TOTAL=$((TOTAL + 1)); done

for TICKER in $TICKERS; do
  COUNT=$((COUNT + 1))
  echo -n "Testing ${TICKER}... (${COUNT}/${TOTAL}) "

  OUTFILE="${OUTDIR}/${TICKER}.json"
  HTTP_CODE=$(curl -s -L -o "$OUTFILE" -w "%{http_code}" --max-time 60 "${BASE_URL}?symbol=${TICKER}" 2>/dev/null)

  # Check if response is HTML (auth redirect) instead of JSON
  IS_HTML=$(head -c 20 "$OUTFILE" 2>/dev/null | grep -c "<!DOCTYPE\|<html" || true)

  if [ "$HTTP_CODE" != "200" ]; then
    echo "FAILED (HTTP ${HTTP_CODE})"
    RESULT_TICKER+=("$TICKER")
    RESULT_STATUS+=("FAIL")
    RESULT_COMPOSITE+=("-")
    RESULT_VOL+=("-")
    RESULT_QUAL+=("-")
    RESULT_REGIME+=("-")
    RESULT_INFO+=("-")
    RESULT_STRATEGY+=("-")
    RESULT_GAPS+=("-")
    RESULT_RUNTIME+=("-")
    RESULT_ERROR+=("HTTP ${HTTP_CODE}")
  elif [ "$IS_HTML" -gt 0 ]; then
    echo "FAILED (auth redirect — got HTML login page)"
    RESULT_TICKER+=("$TICKER")
    RESULT_STATUS+=("FAIL")
    RESULT_COMPOSITE+=("-")
    RESULT_VOL+=("-")
    RESULT_QUAL+=("-")
    RESULT_REGIME+=("-")
    RESULT_INFO+=("-")
    RESULT_STRATEGY+=("-")
    RESULT_GAPS+=("-")
    RESULT_RUNTIME+=("-")
    RESULT_ERROR+=("Auth redirect (307 -> login page)")
  else
    # Check for error field in response
    HAS_ERROR=$(jq -r 'if .error then .error else "none" end' "$OUTFILE" 2>/dev/null)
    if [ "$HAS_ERROR" != "none" ] && [ "$HAS_ERROR" != "null" ] && [ -n "$HAS_ERROR" ]; then
      echo "FAILED (API error: ${HAS_ERROR})"
      RESULT_TICKER+=("$TICKER")
      RESULT_STATUS+=("FAIL")
      RESULT_COMPOSITE+=("-")
      RESULT_VOL+=("-")
      RESULT_QUAL+=("-")
      RESULT_REGIME+=("-")
      RESULT_INFO+=("-")
      RESULT_STRATEGY+=("-")
      RESULT_GAPS+=("-")
      RESULT_RUNTIME+=("-")
      RESULT_ERROR+=("$HAS_ERROR")
    else
      COMP=$(jq -r '.scores.composite.score // "null"' "$OUTFILE" 2>/dev/null)
      VOL=$(jq -r '.scores.vol_edge.score // "null"' "$OUTFILE" 2>/dev/null)
      QUAL=$(jq -r '.scores.quality.score // "null"' "$OUTFILE" 2>/dev/null)
      REG=$(jq -r '.scores.regime.score // "null"' "$OUTFILE" 2>/dev/null)
      INFO=$(jq -r '.scores.info_edge.score // "null"' "$OUTFILE" 2>/dev/null)
      STRAT=$(jq -r '.strategy_suggestion.suggested_strategy // "N/A"' "$OUTFILE" 2>/dev/null)
      GAPS=$(jq -r '.data_gaps | length' "$OUTFILE" 2>/dev/null)
      RUNTIME=$(jq -r '.pipeline_runtime_ms // "?"' "$OUTFILE" 2>/dev/null)
      FETCH_ERRORS=$(jq -r '._fetch_errors // {} | keys | length' "$OUTFILE" 2>/dev/null)

      echo "OK  composite=${COMP} vol=${VOL} qual=${QUAL} reg=${REG} info=${INFO} strat=\"${STRAT}\" gaps=${GAPS} fetch_errs=${FETCH_ERRORS} (${RUNTIME}ms)"

      RESULT_TICKER+=("$TICKER")
      RESULT_STATUS+=("OK")
      RESULT_COMPOSITE+=("$COMP")
      RESULT_VOL+=("$VOL")
      RESULT_QUAL+=("$QUAL")
      RESULT_REGIME+=("$REG")
      RESULT_INFO+=("$INFO")
      RESULT_STRATEGY+=("$STRAT")
      RESULT_GAPS+=("$GAPS")
      RESULT_RUNTIME+=("$RUNTIME")
      RESULT_ERROR+=("")
    fi
  fi

  # Sleep between tickers (except after last)
  if [ "$COUNT" -lt "$TOTAL" ]; then
    sleep "$DELAY"
  fi
done

# ===== SUMMARY TABLE =====
echo ""
echo "========================================================================================================"
echo "SUMMARY TABLE"
echo "========================================================================================================"
printf "%-8s %-8s %10s %10s %10s %10s %10s  %-24s %6s %10s\n" \
  "Ticker" "Status" "Composite" "Vol-Edge" "Quality" "Regime" "Info-Edge" "Strategy" "Gaps" "Runtime"
echo "--------------------------------------------------------------------------------------------------------"

for i in "${!RESULT_TICKER[@]}"; do
  printf "%-8s %-8s %10s %10s %10s %10s %10s  %-24s %6s %10s\n" \
    "${RESULT_TICKER[$i]}" \
    "${RESULT_STATUS[$i]}" \
    "${RESULT_COMPOSITE[$i]}" \
    "${RESULT_VOL[$i]}" \
    "${RESULT_QUAL[$i]}" \
    "${RESULT_REGIME[$i]}" \
    "${RESULT_INFO[$i]}" \
    "${RESULT_STRATEGY[$i]:0:24}" \
    "${RESULT_GAPS[$i]}" \
    "${RESULT_RUNTIME[$i]}"
done

# ===== FAILURES =====
echo ""
echo "========================================================================================================"
echo "FAILURES"
echo "========================================================================================================"
FAIL_COUNT=0
for i in "${!RESULT_TICKER[@]}"; do
  if [ "${RESULT_STATUS[$i]}" = "FAIL" ]; then
    echo "  ${RESULT_TICKER[$i]}: ${RESULT_ERROR[$i]}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "  No failures."
fi

# ===== LOW SCORES (category below 10) =====
echo ""
echo "========================================================================================================"
echo "LOW SCORES — any category below 10 (likely missing data)"
echo "========================================================================================================"
LOW_COUNT=0
for i in "${!RESULT_TICKER[@]}"; do
  if [ "${RESULT_STATUS[$i]}" = "OK" ]; then
    ISSUES=""
    for FIELD in VOL QUAL REGIME INFO; do
      case $FIELD in
        VOL) VAL="${RESULT_VOL[$i]}" ;;
        QUAL) VAL="${RESULT_QUAL[$i]}" ;;
        REGIME) VAL="${RESULT_REGIME[$i]}" ;;
        INFO) VAL="${RESULT_INFO[$i]}" ;;
      esac
      if [ "$VAL" != "null" ] && [ "$VAL" != "-" ]; then
        # Compare as integer (truncate decimal)
        INT_VAL=$(echo "$VAL" | cut -d. -f1)
        if [ -n "$INT_VAL" ] && [ "$INT_VAL" -lt 10 ] 2>/dev/null; then
          ISSUES="${ISSUES} ${FIELD}=${VAL}"
        fi
      fi
    done
    if [ -n "$ISSUES" ]; then
      echo "  ${RESULT_TICKER[$i]}:${ISSUES}"
      LOW_COUNT=$((LOW_COUNT + 1))
    fi
  fi
done
if [ "$LOW_COUNT" -eq 0 ]; then
  echo "  None."
fi

# ===== SCORE RANGES =====
echo ""
echo "========================================================================================================"
echo "SCORE RANGES (min / max / avg across successful tickers)"
echo "========================================================================================================"

for CATEGORY in COMPOSITE VOL QUAL REGIME INFO; do
  MIN=999
  MAX=-1
  SUM=0
  N=0
  for i in "${!RESULT_TICKER[@]}"; do
    if [ "${RESULT_STATUS[$i]}" = "OK" ]; then
      case $CATEGORY in
        COMPOSITE) VAL="${RESULT_COMPOSITE[$i]}" ;;
        VOL) VAL="${RESULT_VOL[$i]}" ;;
        QUAL) VAL="${RESULT_QUAL[$i]}" ;;
        REGIME) VAL="${RESULT_REGIME[$i]}" ;;
        INFO) VAL="${RESULT_INFO[$i]}" ;;
      esac
      if [ "$VAL" != "null" ] && [ "$VAL" != "-" ]; then
        N=$((N + 1))
        # Use awk for float comparison
        MIN=$(echo "$MIN $VAL" | awk '{if ($2 < $1) print $2; else print $1}')
        MAX=$(echo "$MAX $VAL" | awk '{if ($2 > $1) print $2; else print $1}')
        SUM=$(echo "$SUM $VAL" | awk '{print $1 + $2}')
      fi
    fi
  done
  if [ "$N" -gt 0 ]; then
    AVG=$(echo "$SUM $N" | awk '{printf "%.1f", $1 / $2}')
    case $CATEGORY in
      COMPOSITE) LABEL="Composite" ;;
      VOL) LABEL="Vol-Edge " ;;
      QUAL) LABEL="Quality  " ;;
      REGIME) LABEL="Regime   " ;;
      INFO) LABEL="Info-Edge" ;;
    esac
    printf "  %s  min=%-8s max=%-8s avg=%-8s (n=%d)\n" "$LABEL" "$MIN" "$MAX" "$AVG" "$N"
  fi
done

# ===== DONE =====
SUCCESS_COUNT=0
for i in "${!RESULT_STATUS[@]}"; do
  if [ "${RESULT_STATUS[$i]}" = "OK" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done

echo ""
echo "========================================================================================================"
echo "DONE: ${SUCCESS_COUNT}/${TOTAL} succeeded, ${FAIL_COUNT} failed."
echo "Raw JSON files saved to: ${OUTDIR}/"
echo "========================================================================================================"
