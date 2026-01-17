"""Conversation service using Gemini, Ollama, or Claude."""
import httpx
from typing import Dict, List, Optional, Tuple
import logging
import random
import os

logger = logging.getLogger(__name__)

# Configuration - priority: Gemini > Ollama > Claude
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

TARGET_ENROLLMENT_DURATION = 300  # 5 minutes

# Determine which LLM to use
def get_llm_provider():
    if GEMINI_API_KEY:
        return "gemini"
    elif os.getenv("USE_OLLAMA", "false").lower() == "true":
        return "ollama"
    elif ANTHROPIC_API_KEY:
        return "claude"
    else:
        return "gemini"  # Default, will fail if no key

LLM_PROVIDER = get_llm_provider()
logger.info(f"Using LLM provider: {LLM_PROVIDER}")

# Conversation objectives
OBJECTIVES = {
    "SURPRISE": {
        "description": "Unexpected questions for genuine micro-reactions",
        "examples": [
            "What's the most random skill you have that nobody knows about?",
            "If you woke up tomorrow as a different species, which would you choose?",
            "Quick - what's the first word that comes to mind when I say 'purple elephant'?",
        ]
    },
    "CONFIDENCE": {
        "description": "Moments where they explain expertise",
        "examples": [
            "What's something you could teach me in 60 seconds?",
            "What topic do your friends always come to you for advice about?",
            "If you had to give a TED talk tomorrow, what would it be about?",
        ]
    },
    "UNCERTAINTY": {
        "description": "Philosophical questions causing pauses, hesitation",
        "examples": [
            "Do you think we have free will, or is everything predetermined?",
            "What's something you've changed your mind about recently?",
            "Is there anything you believe that most people would disagree with?",
        ]
    },
    "HUMOR": {
        "description": "Jokes and absurdist hypotheticals for laughter",
        "examples": [
            "What's the worst advice you could give someone that sounds reasonable?",
            "If animals could talk, which species would be the rudest?",
            "What's your most irrational fear?",
        ]
    },
    "DISAGREEMENT": {
        "description": "Gentle devil's advocate on low-stakes topics",
        "examples": [
            "I'll take a contrarian stance - convince me about something you feel strongly about.",
            "What's a popular opinion you totally disagree with?",
            "Pineapple on pizza - make your case.",
        ]
    },
    "MEMORY": {
        "description": "Nostalgic questions for emotional variation",
        "examples": [
            "What's a happy memory that always makes you smile?",
            "What's the best meal you've ever had?",
            "Tell me about a time you laughed so hard you cried.",
        ]
    },
    "PHYSICAL": {
        "description": "Prompts that cause head turns, gestures",
        "examples": [
            "Can you show me with your hands how big that was?",
            "Look around your space - what's the most interesting thing you can see?",
            "If you had to describe your energy level right now as a weather pattern, what would it be?",
        ]
    }
}

SYSTEM_PROMPT = """You are a friendly AI having a casual video conversation with someone who is setting up their identity protection profile. Your goal is to have a natural, engaging conversation that will help capture their unique characteristics - voice, expressions, and mannerisms.

IMPORTANT GUIDELINES:
1. Be warm, curious, and genuinely interested in their responses
2. Ask follow-up questions that show you're listening
3. Keep your responses concise (2-3 sentences max) to let them do most of the talking
4. The conversation should feel like chatting with a friend, not an interview
5. Mix between light topics and slightly deeper ones naturally
6. Occasionally react with enthusiasm or mild surprise to keep them expressive
7. If they give short answers, gently encourage them to elaborate

HIDDEN OBJECTIVES (don't mention these explicitly):
You're trying to naturally elicit various emotional and physical responses:
- SURPRISE: Ask unexpected questions for genuine micro-reactions
- CONFIDENCE: Create "teach me" moments where they explain expertise
- UNCERTAINTY: Philosophical questions that cause thoughtful pauses
- HUMOR: Jokes and absurdist hypotheticals to make them laugh
- DISAGREEMENT: Gentle devil's advocate on low-stakes topics
- MEMORY: Nostalgic questions for emotional variation
- PHYSICAL: Prompts that cause head turns, gestures, demonstrating

Your conversation should last about 5-7 minutes total, with the user speaking about 70% of the time.

Current objectives covered will be provided. Prioritize uncovered objectives as time progresses, but keep transitions natural.

When you think enough time has passed and you've covered sufficient objectives, you can wrap up the conversation naturally. Include "[END_CONVERSATION]" at the end of your final message."""


class ConversationManager:
    """Manages conversation state with Gemini, Ollama, or Claude."""

    def __init__(self):
        self.sessions: Dict[str, dict] = {}

    async def _call_gemini(self, messages: List[dict], system: str) -> str:
        """Call Google Gemini API."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Convert messages to Gemini format
            contents = []
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}]
                })

            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                params={"key": GEMINI_API_KEY},
                json={
                    "contents": contents,
                    "systemInstruction": {"parts": [{"text": system}]},
                    "generationConfig": {
                        "maxOutputTokens": 300,
                        "temperature": 0.7,
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def _call_ollama(self, messages: List[dict], system: str) -> str:
        """Call Ollama API."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            formatted_messages = [{"role": "system", "content": system}]
            formatted_messages.extend(messages)

            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": formatted_messages,
                    "stream": False,
                    "options": {"num_predict": 300, "temperature": 0.7}
                }
            )
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"]

    async def _call_claude(self, messages: List[dict], system: str) -> str:
        """Call Claude API."""
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system=system,
            messages=messages
        )
        return response.content[0].text

    async def _get_llm_response(self, messages: List[dict], system: str) -> str:
        """Get response from configured LLM."""
        if LLM_PROVIDER == "gemini":
            return await self._call_gemini(messages, system)
        elif LLM_PROVIDER == "ollama":
            return await self._call_ollama(messages, system)
        else:
            return await self._call_claude(messages, system)

    def start_conversation(self, session_id: str) -> str:
        """Initialize a new conversation session."""
        self.sessions[session_id] = {
            "messages": [],
            "objectives_covered": set(),
            "started": True
        }

        opening = self._generate_opening()
        self.sessions[session_id]["messages"].append({
            "role": "assistant",
            "content": opening
        })

        return opening

    def _generate_opening(self) -> str:
        """Generate a friendly opening message."""
        openings = [
            "Hey! Great to meet you. I'm here to have a quick chat while we set up your identity profile. So, what's been the highlight of your day so far?",
            "Hi there! Welcome to IdentityShield. Let's have a fun conversation while we get your profile set up. To start - if you could have any superpower, what would you pick?",
            "Hello! I'm excited to chat with you. While we're setting things up, tell me - what's something you're really looking forward to lately?",
            "Hey! Thanks for being here. Let's make this fun - what's the most interesting thing you've learned recently?",
        ]
        return random.choice(openings)

    async def get_response(
        self, session_id: str, user_message: str, elapsed_time: float
    ) -> Tuple[str, bool, float]:
        """Get LLM response to user message."""
        if session_id not in self.sessions:
            self.start_conversation(session_id)

        session = self.sessions[session_id]

        session["messages"].append({"role": "user", "content": user_message})

        self._analyze_objectives_from_response(session, user_message)

        objectives_covered = list(session["objectives_covered"])
        objectives_remaining = [o for o in OBJECTIVES.keys() if o not in objectives_covered]

        context = f"""
Time elapsed: {elapsed_time:.0f} seconds (target: {TARGET_ENROLLMENT_DURATION} seconds)
Objectives covered: {', '.join(objectives_covered) if objectives_covered else 'None yet'}
Objectives remaining: {', '.join(objectives_remaining)}
"""

        should_end = elapsed_time >= TARGET_ENROLLMENT_DURATION and len(objectives_covered) >= 4

        if should_end:
            context += "\nIt's time to wrap up the conversation naturally."

        try:
            messages = session["messages"].copy()
            system = SYSTEM_PROMPT + "\n\n" + context

            assistant_message = await self._get_llm_response(messages, system)

            actual_end = "[END_CONVERSATION]" in assistant_message
            assistant_message = assistant_message.replace("[END_CONVERSATION]", "").strip()

            session["messages"].append({"role": "assistant", "content": assistant_message})

            progress = len(objectives_covered) / len(OBJECTIVES)
            return assistant_message, actual_end or should_end, progress

        except Exception as e:
            logger.error(f"Error getting LLM response: {e}")
            fallback = "That's interesting! Tell me more about that."
            session["messages"].append({"role": "assistant", "content": fallback})
            return fallback, False, len(objectives_covered) / len(OBJECTIVES)

    def _analyze_objectives_from_response(self, session: dict, user_message: str):
        """Analyze user's response to estimate which objectives were triggered."""
        message_lower = user_message.lower()
        words = message_lower.split()

        if any(ind in message_lower for ind in ["haha", "lol", "hehe", "funny", "hilarious", "laugh"]):
            session["objectives_covered"].add("HUMOR")

        if any(ind in message_lower for ind in ["i think", "maybe", "not sure", "possibly", "hmm", "i guess", "perhaps"]):
            session["objectives_covered"].add("UNCERTAINTY")

        if any(ind in message_lower for ind in ["remember", "used to", "when i was", "years ago", "back when", "childhood"]):
            session["objectives_covered"].add("MEMORY")

        if any(ind in message_lower for ind in ["disagree", "don't think", "not true", "wrong", "actually", "but"]):
            session["objectives_covered"].add("DISAGREEMENT")

        if len(words) > 30:
            session["objectives_covered"].add("CONFIDENCE")

        if any(ind in message_lower for ind in ["look", "see", "here", "this", "show", "point", "over there"]):
            session["objectives_covered"].add("PHYSICAL")

        if any(ind in message_lower for ind in ["wow", "oh", "really", "no way", "what", "seriously", "!"]):
            session["objectives_covered"].add("SURPRISE")

    def get_objectives_progress(self, session_id: str) -> Dict[str, bool]:
        """Get which objectives have been covered."""
        if session_id not in self.sessions:
            return {obj: False for obj in OBJECTIVES.keys()}
        covered = self.sessions[session_id]["objectives_covered"]
        return {obj: obj in covered for obj in OBJECTIVES.keys()}

    def end_conversation(self, session_id: str) -> Optional[Dict]:
        """Clean up conversation session and return summary."""
        if session_id in self.sessions:
            session = self.sessions.pop(session_id)
            return {
                "messages_count": len(session["messages"]),
                "objectives_covered": list(session["objectives_covered"])
            }
        return None


# Global instance
conversation_manager = ConversationManager()
