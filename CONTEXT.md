# Läxhjälpen — projektstatus

## Stack
- React + Vite, hosted på Netlify
- Supabase (auth, PostgreSQL, storage)
- Anthropic API (direkt från frontend, temporärt)

## Vad som fungerar
- Föräldraregistrering + inloggning
- Lägga till barn (utan auth, direkt i profiles-tabellen)
- Lägga till läxor med text, deadline och provdatum
- AI-generering av övningsfrågor

## Kända begränsningar / nästa steg
- PDF-uppladdning fungerar inte (storage ej konfigurerad)
- Anthropic API-nyckel ligger i .env (bör flyttas till edge function)
- PIN-inloggning för barn ej byggd
- Inga påminnelser för deadlines/prov ännu