#!/bin/bash
curl -s -X POST http://localhost:3000/api/generate-card \
  -H "Content-Type: application/json" \
  -d '{"object_name":"test","category":"weapon","size":"medium"}' | head -c 500
echo
curl -s -X POST http://localhost:3000/api/generate-boss \
  -H "Content-Type: application/json" \
  -d '{"analysis":{"object_name":"boss","category":"animal","size":"large"},"roundIndex":0}' | head -c 500
echo
curl -s -X POST http://localhost:3000/api/buff-choices | head -c 300
echo
