# Läxhjälpen

En app för att hjälpa barn med läxor – ladda upp material, generera AI-övningar och håll koll på deadlines och prov.

## Stack

- **Frontend**: React + Vite, hosted on Netlify
- **Backend/DB**: Supabase (PostgreSQL + Storage + Auth)
- **AI**: Anthropic Claude via Supabase Edge Function

---

## Kom igång

### 1. Klona och installera

```bash
cd homework-app
npm install
```

### 2. Skapa Supabase-projekt

1. Gå till [supabase.com](https://supabase.com) och skapa ett nytt projekt
2. Gå till **SQL Editor** och kör hela innehållet i `supabase/schema.sql`
3. Gå till **Project Settings → API** och kopiera:
   - `Project URL`
   - `anon public` key

### 3. Konfigurera miljövariabler

```bash
cp .env.example .env
```

Fyll i `.env`:
```
VITE_SUPABASE_URL=https://ditt-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=din-anon-nyckel
```

### 4. Deploya edge function

Installera Supabase CLI om du inte har det:
```bash
npm install -g supabase
```

Logga in och länka projektet:
```bash
supabase login
supabase link --project-ref ditt-projekt-id
```

Sätt din Anthropic API-nyckel som secret:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Deploya funktionen:
```bash
supabase functions deploy generate-exercise
```

### 5. Starta lokalt

```bash
npm run dev
```

---

## Deploya till Netlify

1. Pusha koden till GitHub
2. Koppla repot i [netlify.com](https://netlify.com)
3. Bygg-inställningar:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Lägg till miljövariabler under **Site settings → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## Databasstruktur

| Tabell | Beskrivning |
|--------|-------------|
| `profiles` | Föräldrar och barn (extends Supabase auth) |
| `materials` | Uppladdade läxor (PDF eller text) |
| `exercises` | AI-genererade övningsfrågor |
| `answers` | Barnens svar på övningar |

### Fält för datum i `materials`

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `due_date` | date | När läxan ska vara inlämnad |
| `is_exam` | boolean | Om läxan är kopplad till ett prov |
| `exam_date` | date | Provdatum |
| `exam_subject` | text | Provets namn, t.ex. "Matteprov kap. 3" |

---

## Nästa steg

- [ ] PIN-inloggning för barn (utan e-post)
- [ ] Push-notiser för kommande deadlines
- [ ] Progressstatistik per ämne i föräldradashboard
- [ ] Stöd för bilduppladdning (handskrivna anteckningar)
- [ ] Textextraktion från PDF server-side (via edge function + pdfjs)
