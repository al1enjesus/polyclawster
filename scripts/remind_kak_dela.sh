#!/bin/bash
BOT_TOKEN="8242939132:AAEAjPh5KRukhjF84XhNZPSuEswde_Tvems"
CHAT_ID="399089761"
MSG="Эй, как дела? 👋"
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}&text=${MSG}" > /dev/null 2>&1
