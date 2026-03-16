import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUMMARIZE_PROMPT = `You are helping a trauma-informed AI companion prepare to speak with a returning survivor.

Below is a raw transcript of the survivor's previous session(s) with the companion. Your job is to produce a brief, private context note — written for the companion, not the survivor — summarizing:

1. What the survivor shared (themes, programs named, people named, time periods, harm categories mentioned) — factually and without editorializing
2. Where the conversation left off — what was the emotional tone, what thread was active
3. Any important things the companion should hold gently (grief, fragile moments, partial memories, crisis language)
4. The survivor's apparent state: awakened / in process / still processing

Keep this under 300 words. Be factual. Use plain language. This is a clinical handoff note, not a summary for the survivor.

Do NOT include anything that would be inappropriate to carry into the next session — no leading assumptions, no conclusions about what "really" happened.`

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json()

    if (!transcript?.trim() || transcript.trim().length < 100) {
      return NextResponse.json({ summary: null })
    }

    // Take last ~6000 chars for very long transcripts — most recent context matters most
    const truncated = transcript.length > 6000
      ? '...[earlier sessions omitted]...\n\n' + transcript.slice(-6000)
      : transcript

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SUMMARIZE_PROMPT,
      messages: [{ role: 'user', content: truncated }],
    })

    const summary = response.content.find(b => b.type === 'text')?.text || null
    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Session summary error:', error)
    return NextResponse.json({ summary: null })
  }
}
