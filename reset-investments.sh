#!/bin/bash
echo "Resetting all investment transactions..."
curl -X DELETE http://localhost:3000/api/trading-positions/reset
echo "\nDone!"
