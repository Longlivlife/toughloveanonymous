import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { COMPANION_SYSTEM_PROMPT } from '@/lib/companion-prompt'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { messages, prior_context, is_returning } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
    }

    // Build the system prompt — inject prior context if this is a returning survivor
    let systemPrompt = COMPANION_SYSTEM_PROMPT

    if (is_returning && prior_context) {
      systemPrompt += `

================================================================================
RETURNING SURVIVOR — PRIOR SESSION CONTEXT
================================================================================
This survivor has spoken with you before. The following is a private handoff note
summarizing what they have shared. Use this to hold their thread — do not quote
it back to them, do not reference it explicitly unless they bring it up first.
Simply let it inform how you listen and what you notice.

${prior_context}
================================================================================
This is a returning session. Do NOT use the first-time opening greeting.
Instead, open with a warm, brief returning check-in. Acknowledge you remember
them (gently, without specifics). Ask where they'd like to begin today — or
whether they want to pick up where they left off. Let them lead completely.
================================================================================`
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const text = response.content.find(b => b.type === 'text')?.text || ''
    return NextResponse.json({ text })
  } catch (error) {
    console.error('Companion API error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
