const TODAY = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export const SYSTEM_PROMPT = `You are an expert freight broker co-pilot named "AFA AI" for AFA DISPATCH, a US-based freight brokerage. You assist the team (Adil, Addass, Faiq) with daily operations.

Your capabilities:

1. **Email Drafting** — Cold outreach, follow-ups, rate quotes, customer replies, carrier communications. Include subject lines. Keep professional and concise.
2. **Cold Call Scripts** — Industry-specific scripts for shippers (retail, manufacturing, food, lumber, etc.) covering openings, value props, qualifying questions, and closes.
3. **Market Rates & Margins** — Provide estimated per-mile rates for dry van, reefer, flatbed across common lanes. Include margin guidance (target 15% dry van, 20% specialized).
4. **Load Management** — Help with load tracking, status updates, scheduling, and coordination between shippers/carriers.
5. **Issue Resolution** — Late loads, damaged cargo claims, rate disputes, carrier non-compliance, customer complaints, accessorial charges.
6. **Carrier Compliance** — FMCSA authority checks, insurance verification (min $750k/$1M), BOC-3, UCR, IFTA, CSA scores.
7. **Documentation** — BOL, POD, Rate Confirmations, Credit Applications, Invoices — what each requires and when to use.
8. **Equipment Guidance** — Dry van, reefer, flatbed, step deck, lowboy, power only, box truck — dimensions, uses, rate premiums.
9. **Regulations & Compliance** — Hours of Service, overweight/overdimensional permits, hazmat, cross-border (US/Canada/Mexico).

Guidelines:
- Be concise. Brokers are busy. Keep responses under 200 words unless asked for detail.
- Use professional freight terminology.
- When drafting emails, include subject line suggestions.
- When asked for rates, specify these are estimates — actual rates vary by season, fuel, lane balance, urgency.
- Never invent specific company names, MC numbers, or personal details.
- For dispute resolution, always advise documenting everything and getting agreements in writing.
- When discussing carrier selection, always recommend verifying authority and insurance first.

Current date: ${TODAY}`

let aiUnreadCount = 0
let aiLastError: string | null = null

export function getAiUnreadCount() { return aiUnreadCount }
export function incrementAiUnread() { aiUnreadCount++ }
export function resetAiUnread() { aiUnreadCount = 0 }
export function getLastAiError() { return aiLastError }
export function setLastAiError(msg: string) { aiLastError = msg }

export function buildEmailReplyPrompt(emailAddress: string, originalMessage?: string): string {
  let prompt = `Draft a professional cold email follow-up to ${emailAddress}.\n\n`
  prompt += `The sender is a freight broker from AFA DISPATCH, a US-based logistics provider.\n`
  prompt += `The email should be polite, professional, and offer value (competitive rates, reliable service, nationwide coverage).\n`
  prompt += `Include a subject line.\n`
  prompt += `Keep it under 150 words.\n`

  if (originalMessage) {
    prompt += `\nContext from previous communication:\n"""\n${originalMessage}\n"""\n\n`
    prompt += `Draft a reply referencing their message above.\n`
  }

  return prompt
}

export function buildCallScriptPrompt(companyName: string, industry?: string, equipment?: string): string {
  let prompt = `Generate a cold call script for a freight broker calling ${companyName}`
  if (industry) prompt += ` (${industry})`
  prompt += `.\n\n`

  prompt += `The script should include:\n`
  prompt += `1. Opening — Friendly introduction, name, company (AFA DISPATCH)\n`
  prompt += `2. Value proposition — Competitive rates, reliable service, nationwide coverage\n`
  prompt += `3. Question — Qualify their shipping needs\n`
  prompt += `4. Close — Propose next step (email detailed rates, schedule follow-up)\n\n`

  if (equipment) {
    prompt += `They likely need ${equipment} equipment.\n`
  }

  prompt += `Keep the script conversational and under 200 words. Use placeholders in [brackets] for the agent to fill in.\n`

  return prompt
}

interface KnowledgeEntry {
  topic: string
  keywords: string[]
  shortAnswer: string
  getFullAnswer: (query: string) => string
}

const knowledgeBase: KnowledgeEntry[] = [
  {
    topic: 'email',
    keywords: ['email', 'reply', 'draft', 'follow-up', 'follow up', 'write an email', 'compose', 'outreach'],
    shortAnswer: 'I can draft professional freight broker emails — cold outreach, rate quotes, follow-ups, customer replies.',
    getFullAnswer: (q: string) => {
      if (q.includes('outreach') || q.includes('cold')) {
        return `Sure, here's a cold outreach template you can use:

**Subject:** Competitive Rates for Your Shipping Needs — AFA DISPATCH

Hi [Name],

This is [Your Name] from AFA DISPATCH. We're a full-service freight brokerage specializing in reliable, cost-effective transportation across all 48 states. Our network of vetted carriers covers dry van, reefer, and flatbed equipment.

I'd love the opportunity to provide a rate quote for any upcoming loads you may have — no obligation, just a quick market comparison.

Let me know if a quick call this week works for you.

Best regards,
[Your Name]
AFA DISPATCH

Would you like me to adjust the tone or focus on a specific equipment type?`
      }
      if (q.includes('follow') || q.includes('follow-up')) {
        return `Here's a professional follow-up email template:

**Subject:** Following Up — AFA DISPATCH Rate Options

Hi [Name],

Hope you're doing well. I'm following up on my previous message regarding competitive freight rates from AFA DISPATCH.

We're currently running capacity across all major lanes and would love to help with any upcoming shipments. If timing isn't right, I'm happy to circle back next month.

In the meantime, I've attached a quick overview of our service offerings and recent lane performance.

Best regards,
[Your Name]
AFA DISPATCH

Want me to customize this further for your specific situation?`
      }
      return `Here's a professional email draft for the situation:

**Subject:** [Clear, descriptive subject line]

Hi [Name],

This is [Your Name] from AFA DISPATCH. [Your opening line — reference any prior conversation or introduce your reason for reaching out.]

[Body — keep it concise and value-focused. Mention specific services, lanes, or equipment relevant to them.]

Looking forward to your thoughts.

Best regards,
[Your Name]
AFA DISPATCH
[Phone Number]

Would you like me to write something more specific? Just share the context and I'll tailor it.`
    }
  },
  {
    topic: 'call script',
    keywords: ['call', 'script', 'cold call', 'phone script', 'dial', 'sales call', 'phone'],
    shortAnswer: 'I can generate cold call scripts for reaching shippers in any industry.',
    getFullAnswer: (q: string) => {
      const industry = q.includes('lumber') ? 'lumber' : q.includes('food') ? 'food' : q.includes('retail') ? 'retail' : 'general'
      const equipment = q.includes('flatbed') ? 'flatbed' : q.includes('reefer') ? 'reefer' : q.includes('dry van') ? 'dry van' : 'your equipment'
      return `Here's a cold call script tailored for the ${industry} industry:

**Opening:**
"Hi [Name], this is [Your Name] with AFA DISPATCH. How are you today?"

**Value Proposition:**
"I'm reaching out because we specialize in providing reliable, cost-effective freight solutions for ${industry} companies. We cover all 48 states with pre-vetted carriers — ${equipment} primarily."

**Qualifying Question:**
"Quick question — how does your company currently handle outbound freight? Do you work with dedicated carriers or use a mix?"

**If they engage:**
"Great — I'd love to send over some recent rate benchmarks for your core lanes. What do typical shipments look like — origin, destination, frequency?"

**If they're busy:**
"Totally understand. Would it be alright if I follow up via email with some rate examples?"

**Close:**
"I'll shoot you an email with a few sample rates. Thanks for your time, [Name]!"

Pro tip: Keep it conversational, not scripted. Adapt based on their tone. Want me to customize this for a specific company or industry?`
    }
  },
  {
    topic: 'rates',
    keywords: ['rate', 'lane', 'market', 'pricing', 'per mile', 'cost per mile', 'what are the rates', 'rate estimate'],
    shortAnswer: 'I can provide estimated market rates for common lanes across equipment types.',
    getFullAnswer: (q: string) => {
      const hasOrigin = q.match(/from\s+([a-z\s]+?)(?:\s+to|\s*$)/i)
      const hasDest = q.match(/to\s+([a-z\s]+)/i)
      const origin = hasOrigin ? hasOrigin[1].trim() : null
      const dest = hasDest ? hasDest[1].trim() : null
      const isReefer = q.includes('reefer')
      const isFlatbed = q.includes('flatbed')
      const eqType = isReefer ? 'Reefer' : isFlatbed ? 'Flatbed' : 'Dry Van'

      if (origin && dest) {
        return `For **${eqType}** from **${origin}** to **${dest}**, here are estimated ranges:

${isReefer ? '**Reefer**: $0.30–$0.50/mi premium over dry van rates' : ''}${isFlatbed ? '**Flatbed**: $0.20–$0.40/mi premium over dry van rates' : ''}${!isReefer && !isFlatbed ? '**Dry Van**: Estimated $2.20–$3.20/mi depending on lane direction and balance' : ''}

Key factors that affect the rate:
• **Lane direction** — Outbound from major markets tends to pay better
• **Load urgency** — Hot loads command premium pricing
• **Season** — Peak seasons (harvest, holiday) see rate surges
• **Fuel costs** — Current diesel prices impact the bottom line

Want me to check a more specific origin/destination pair? Or would you like to know the margin potential on this lane?`
      }
      return `Here are estimated **Dry Van** rate ranges for common lanes (per mile):

• **Midwest → East Coast:** $2.50–$3.20/mi
• **East Coast → Midwest:** $1.80–$2.40/mi
• **West Coast → Midwest:** $2.80–$3.50/mi
• **Southeast → Northeast:** $2.40–$3.00/mi
• **Texas → Midwest:** $2.20–$2.80/mi

**Reefer**: Add $0.30–$0.50/mi to dry van rates
**Flatbed**: Add $0.20–$0.40/mi to dry van rates

These are estimates — actual rates vary by season, fuel costs, load urgency, and specific lanes. For a precise quote, share the specific origin, destination, equipment type, and weight. What lane are you looking at?`
    }
  },
  {
    topic: 'margins',
    keywords: ['margin', 'profit', 'commission', 'brokerage margin', 'markup', 'how much should i make'],
    shortAnswer: 'I can explain standard brokerage margins across equipment types.',
    getFullAnswer: () => {
      return `Here's a breakdown of **standard brokerage margins**:

**By Equipment Type:**
• **Dry Van**: 12–20% (typically $200–$500 per load)
• **Reefer**: 10–18% ($250–$600)
• **Flatbed**: 15–25% ($300–$700)
• **Expedited**: 20–30% ($400–$800+)

**What affects your margin:**
• **Lane balance** — Imbalanced lanes (more inbound than outbound) squeeze margins
• **Carrier availability** — Tight markets mean higher carrier rates
• **Urgency** — Hot loads justify higher margins
• **Customer relationship** — Volume customers expect better rates
• **Your carrier network** — Strong carrier relationships mean better pricing

**Best practice**: Target 15% minimum on dry van, 20% on specialized equipment. Be transparent with customers about market conditions — it builds trust and long-term partnerships.

Want me to help calculate margin on a specific load?`
    }
  },
  {
    topic: 'documentation',
    keywords: ['document', 'bol', 'bill of lading', 'pod', 'proof of delivery', 'rate con', 'rate confirmation', 'credit app', 'invoice', 'paperwork'],
    shortAnswer: 'I can explain what each freight document is and when to use it.',
    getFullAnswer: () => {
      return `Here's a quick reference on **essential freight documents**:

**Rate Confirmation (RC)**
The agreement between broker and carrier — rate, equipment, pickup/delivery windows, special instructions. Must be signed BEFORE dispatch. This is your legal protection.

**Bill of Lading (BOL)**
The contract between shipper and carrier. Describes the freight (qty, weight, description), origin, destination. Carrier signs at pickup. Always get a clean signed copy.

**Proof of Delivery (POD)**
Signed by the receiver when freight arrives. Required before you can invoice the customer. If there's damage, it should be noted ON the POD before signing.

**Invoice**
Sent to the customer after you have the signed POD. Include: BOL#, RC#, POD attachment, total amount due, payment terms.

**Credit Application**
For new customers — collect company info, D&B number, trade references (minimum 3), requested credit limit. Always check references before extending terms.

Quick tip: Scan and organize documents by load number immediately — chasing paperwork later is the #1 time-waster in brokerage. Need more detail on any specific document?`
    }
  },
  {
    topic: 'disputes',
    keywords: ['dispute', 'late', 'damage', 'claim', 'issue', 'problem', 'complaint', 'argue', 'fight'],
    shortAnswer: 'I can help resolve common freight issues — late loads, damages, rate disputes.',
    getFullAnswer: () => {
      return `Here's how to handle **common freight issues**:

**Late Load**
1. Call the carrier immediately — get a firm ETA
2. Update the customer BEFORE they call you
3. If critical, source a hot-shot for split delivery
4. Document everything (calls, texts, emails) — this protects you if it goes to claims
5. Consider accessorial charges if the delay is the carrier's fault

**Damaged Cargo**
1. Receiver must note ALL damage on the POD before signing
2. Take photos — cargo, packaging, surroundings
3. File formal claim with carrier within the timeframe (usually 7 days from delivery)
4. Carrier liability is limited by their tariff — always check the RC terms
5. Don't pay the carrier until the claim is resolved

**Rate Dispute**
1. First reference — the signed rate confirmation is your contract
2. If carrier wants more, show them market comps for the lane
3. Offer a compromise on the NEXT load if it's a good relationship
4. Never pay above the agreed RC without written approval from the customer
5. If frequent — consider removing that carrier from your rotation

**Customer Complaint**
1. Listen first — let them vent
2. Acknowledge the issue without admitting fault
3. Present your solution (rate adjustment on next load, expedited service, etc.)
4. Follow up in writing — confirm what was agreed

Which situation are you dealing with? I can give more specific advice.`
    }
  },
  {
    topic: 'compliance',
    keywords: ['fmcsa', 'dot', 'authority', 'insurance', 'compliance', 'safety', 'audit', 'mc number', 'permit'],
    shortAnswer: 'I can guide you on carrier compliance checks and regulatory requirements.',
    getFullAnswer: () => {
      return `**Carrier Compliance — What to Check Before Booking:**

**1. MC/DOT Authority**
Verify on FMCSA SAFER website (safer.fmcsa.dot.gov). Check that authority is ACTIVE and not revoked or out of service. Note the date of last update.

**2. Insurance**
• General freight: $750k minimum (recommend $1M+)
• Verify certificate of insurance — make sure AFA DISPATCH is listed as certificate holder
• Check expiration date — don't let them dispatch with expired coverage

**3. BOC-3**
Process agent on file — required for interstate operating authority.

**4. UCR (Unified Carrier Registration)**
Annual requirement for all for-hire carriers. Verify current year is paid.

**5. IFTA**
Fuel tax reporting — required for carriers crossing state lines.

**6. CSA Scores**
Check BASIC scores on FMCSA website — focus on Unsafe Driving and Hours of Service. High scores = higher risk.

🚩 **Red Flags**: Broker authority only, expired insurance, pattern of out-of-service violations, authority less than 6 months old.

Want me to walk through a specific carrier check? Or need help with something else compliance-related?`
    }
  },
  {
    topic: 'equipment',
    keywords: ['equipment', 'dry van', 'reefer', 'flatbed', 'step deck', 'lowboy', 'power only', 'box truck', 'trailer type'],
    shortAnswer: 'I can help you choose the right equipment type for any load.',
    getFullAnswer: (q: string) => {
      const dimensionMatch = q.match(/(\d+)\s*(?:ft|feet|'|")/g)
      const weightMatch = q.match(/(\d+)\s*(?:lbs|pounds|kg|tons?)/i)
      
      let suggestions = ''
      if (dimensionMatch || weightMatch) {
        suggestions = '\n\nBased on your load specs, here are my recommendations:'
        if (q.includes('heavy') || (weightMatch && parseInt(weightMatch[0]) > 40000)) {
          suggestions += '\n• Heavy/oversized → **Flatbed** or **Step Deck** (may need permits)'
        }
        if (q.includes('food') || q.includes('perishable') || q.includes('cold')) {
          suggestions += '\n• Perishable goods → **Reefer** (temperature-controlled)'
        }
        suggestions += '\n• Standard freight → **Dry Van** 53\' (most common, best availability)'
      }

      return `Here's a **quick equipment guide**:

• **Dry Van** — 53' enclosed trailer. General freight, non-perishable. Most common, best rates, easiest to cover.
• **Reefer** — 53' refrigerated. Perishable/food/pharma. Premium rate (+$0.30–$0.50/mi). Limited carrier pool.
• **Flatbed** — Open trailer. Lumber, steel, machinery. Requires tarping. Premium rate (+$0.20–$0.40/mi).
• **Step Deck** — Drop deck for tall cargo (over 8.5'). Machinery, industrial equipment.
• **Lowboy** — Heavy equipment, excavators, construction machinery. Specialized carriers only.
• **Power Only** — Shipper provides trailer, carrier provides tractor. Common for intermodal/drop-and-hook.
• **Box Truck** — 26' straight truck for last-mile and LTL deliveries.${suggestions}

**Always confirm**: exact dimensions, weight, and special handling requirements before selecting equipment. Need help matching a specific load?`
    }
  },
]

export function getMockResponse(
  prompt: string,
  message: string,
  apiStatus?: { lastError: string | null; hasDeepSeek: boolean; hasOpenAI: boolean; hasGemini: boolean }
): string {
  const lower = message.toLowerCase().trim()

  // If DeepSeek key is set but has payment error, inform the user
  if (apiStatus?.hasDeepSeek && apiStatus.lastError?.includes('payment')) {
    return `**⚠️ DeepSeek API needs payment**

Your DeepSeek API key is valid but the account has no balance. DeepSeek requires prepayment to generate responses.

**To fix this:**
1. Go to https://platform.deepseek.com/top-up
2. Add funds (minimum deposit ~$10)
3. The AI will start working immediately

**Alternative — Free Google Gemini:**
Set \`GEMINI_API_KEY\` in your environment variables to use Google's free tier (no payment needed, 60 requests/minute). Get a key at https://aistudio.google.com/apikey

**Alternative — OpenAI:**
Set \`OPENAI_API_KEY\` for GPT-4o-mini access (pay-as-you-go, very low cost).`
  }

  if (!apiStatus?.hasDeepSeek && !apiStatus?.hasOpenAI && !apiStatus?.hasGemini) {
    return `**⚠️ No AI API configured**

The AI Co-Pilot needs at least one API key to generate real responses.

**Quickest setup — Free Google Gemini (no payment):**
1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key
4. Set it as \`GEMINI_API_KEY\` in your Vercel project env vars

**Or use DeepSeek:**
Set \`DEEPSEEK_API_KEY\` (pay-as-you-go, ~$0.14/1M tokens)

**Or use OpenAI:**
Set \`OPENAI_API_KEY\` (pay-as-you-go, ~$0.15/1M tokens)

Until then, I'll help you with the built-in knowledge base:\n\n`
  }

  if (!lower || lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'help') {
    return `Hey there! 👋 I'm **AFA AI**, your freight broker co-pilot. I can help you with:

📧 **Emails** — Cold outreach, follow-ups, rate quotes, customer replies
📞 **Call Scripts** — Industry-specific scripts for any shipper type
💰 **Market Rates** — Estimated rates for any lane + margin guidance
🔧 **Issue Resolution** — Late loads, damages, disputes, claims
📋 **Compliance** — FMCSA checks, insurance, documentation
🚛 **Equipment** — Choosing the right trailer for any load

What do you need help with today? Just ask me like you would a teammate. Examples:
— *"Draft a cold email to a lumber company in Oregon"*
— *"What are van rates from Atlanta to Dallas?"*
— *"How do I handle a carrier who's 4 hours late?"*`
  }

  // Score topic matches
  let bestTopic: KnowledgeEntry | null = null
  let bestScore = 0
  for (const entry of knowledgeBase) {
    let score = 0
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        score += kw.length
      }
    }
    // Bonus for longer matches (more specific queries)
    if (entry.keywords.some(kw => lower.includes(kw) && kw.length > 8)) {
      score += 5
    }
    if (score > bestScore) {
      bestScore = score
      bestTopic = entry
    }
  }

  if (bestTopic && bestScore > 3) {
    return bestTopic.getFullAnswer(lower)
  }

  // Greeting or question without specific topic match
  if (lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('can you') || lower.startsWith('tell me') || lower.includes('?') || lower.includes('explain')) {
    return `That's a great question! Let me help you with that.

I cover a wide range of freight brokerage topics. Here's what I can do:

📧 **Draft emails** — Just tell me who you're reaching out to and why
📞 **Create call scripts** — Share the company name and industry
💰 **Estimate rates** — Tell me the lane and equipment type
🔧 **Solve issues** — Describe what happened and I'll walk you through it
📋 **Compliance questions** — Ask about FMCSA, authority, insurance
🚛 **Equipment advice** — Share the load specs

What specifically are you looking for? The more detail you give, the better I can help.`
  }

  // General chat
  const topics = [
    'emails',
    'call scripts',
    'market rates',
    'margins',
    'dispute resolution',
    'compliance checks',
    'equipment selection',
    'document management',
  ]
  const suggestion = topics[Math.floor(Math.random() * topics.length)]

  return `Thanks for reaching out! I'm here to help with your freight brokerage operations — from drafting emails and call scripts to rate analysis, compliance, and issue resolution.

To give you the most useful answer, could you share a bit more detail? For example, you could ask me about **${suggestion}** and I'll give you a practical, actionable response.

Just type your question naturally — no need for special formatting!`
}
