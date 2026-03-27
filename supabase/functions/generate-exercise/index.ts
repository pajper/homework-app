// supabase/functions/generate-exercise/index.ts
// Deploy with: supabase functions deploy generate-exercise

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content, subject, due_date, is_exam, exam_date, exam_subject, child_name } = await req.json()

    const daysUntilDue = due_date
      ? Math.ceil((new Date(due_date).getTime() - Date.now()) / 86400000)
      : null

    const daysUntilExam = exam_date
      ? Math.ceil((new Date(exam_date).getTime() - Date.now()) / 86400000)
      : null

    const urgencyNote = daysUntilExam !== null && daysUntilExam <= 5
      ? `IMPORTANT: There is an exam in ${daysUntilExam} days (${exam_subject}). Focus on repetition and key concepts.`
      : daysUntilDue !== null && daysUntilDue <= 2
      ? `The homework is due in ${daysUntilDue} day(s). Keep exercises focused and practical.`
      : ''

    const systemPrompt = `You are a friendly Swedish school tutor helping a child named ${child_name} practice their homework.
Generate exercises in Swedish that are age-appropriate, encouraging, and educational.
Always respond with valid JSON only — no markdown, no explanation.
${urgencyNote}`

    const userPrompt = `Create 5 practice exercises for the following homework material.

Subject: ${subject}
Material:
${content}

Return a JSON array of exercise objects, each with:
- question (string, in Swedish)
- type ("multiple_choice", "open", or "true_false")
- options (array of 4 strings if multiple_choice, null otherwise)
- correct_answer (string)
- difficulty ("easy", "medium", or "hard")

Example format:
[
  {
    "question": "Vad är huvudstaden i Sverige?",
    "type": "multiple_choice",
    "options": ["Oslo", "Stockholm", "Göteborg", "Malmö"],
    "correct_answer": "Stockholm",
    "difficulty": "easy"
  }
]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const aiData = await response.json()
    const raw = aiData.content[0].text.replace(/```json|```/g, '').trim()
    const exercises = JSON.parse(raw)

    return new Response(JSON.stringify({ exercises }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
