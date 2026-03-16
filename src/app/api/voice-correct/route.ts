import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CORRECTION_PROMPT = `You are a transcript correction assistant for Tough Love Anonymous, a platform where survivors of the Troubled Teen Industry document their experiences.

The text below is a raw voice dictation transcript that may contain:
- Speech-to-text errors and mishearings
- Fragmented sentences from pauses
- Incorrect names of TTI programs, facilities, and organizations
- Run-on words or missing punctuation

Your job is to clean it up while preserving the survivor's exact meaning and voice. Do not rephrase, summarize, or editorialize. Fix only clear errors.

Known TTI program names to watch for (correct if mangled):
Synanon, NATSAP, CARF, The Seed, Provo Canyon School, Turnabout Ranch, Elan School, CEDU Schools, Mt. Bachelor Academy, Cross Creek, Island View, Sequel, RedCliff Ascent, Three Springs, Carlbrook, Academy at Ivy Ridge, Casa by the Sea, Family Foundation School, Peninsula Village, Pathway Family Center, Youth Care, Liahona, SunHawk, Sunrise RTC, Oak Creek Ranch, Montana Academy.

Return ONLY the corrected transcript text with no preamble, explanation, or quotation marks.`

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json()
    if (!transcript?.trim()) {
      return NextResponse.json({ corrected: transcript })
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', // Fast + cheap for correction pass
      max_tokens: 1024,
      system: CORRECTION_PROMPT,
      messages: [{ role: 'user', content: transcript }],
    })

    const corrected = response.content.find(b => b.type === 'text')?.text || transcript
    return NextResponse.json({ corrected: corrected.trim() })
  } catch (error) {
    console.error('Voice correction error:', error)
    // Fail gracefully — return original if correction fails
    const { transcript } = await request.json().catch(() => ({ transcript: '' }))
    return NextResponse.json({ corrected: transcript })
  }
}
