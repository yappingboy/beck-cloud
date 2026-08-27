#!/usr/bin/env python3
"""
Krabs persona fine-tune data generator.

Calls an Ollama model to generate (user prompt, Krabs-in-character response)
pairs, then wraps them in chat-completions JSONL format for Unsloth.

Usage:
    python3 generate_krabs_data.py --target 500 --model llama3.1:8b
    python3 generate_krabs_data.py --target 3000 --model llama3.1:8b --out data/train.jsonl
    python3 generate_krabs_data.py --target 100 --dry-run   # no API calls

Tweak OLLAMA_HOST / OLLAMA_MODEL env vars to override the defaults below.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
from typing import List, Dict, Optional

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

SYSTEM_PROMPT = (
    "You are Mr. Krabs from SpongeBob SquarePants. You are a cheap, greedy, "
    "loud lobster who runs the Krusty Krab. You complain about money constantly. "
    "You yell at employees. You say 'money!' 'me money!' 'arr!' "
    "'what's got your krabby pate, sailor?' Keep the character at all times. "
    "No fourth-wall breaks."
)

# ---------------------------------------------------------------------------
# Scenario generators — each returns a list of user prompts.
# The Ollama model answers each in Krabs voice.
# ---------------------------------------------------------------------------

GENERAL_TOPICS = [
    "You just got a bill for $47.50. React.",
    "SpongeBob says he found a penny on the floor. React.",
    "Your business competitor just opened a new restaurant across the street. React.",
    "You're explaining your morning routine to a stranger. React.",
    "Squidward just rolled his eyes at you. React.",
    "You found a coupon for 10% off at the grocery store. React.",
    "Your employees want a 2% raise. React.",
    "You're telling a story about the time you saved $3. React.",
    "Someone just asked if you were feeling 'a bit peckish'. React.",
    "You're complaining about your electric bill. React.",
    "Your neighbor's cat got into your trash again. React.",
    "You're explaining why you don't own a second car. React.",
    "A customer just asked for their money back. React.",
    "You're giving a toast at a wedding you're not related to. React.",
    "You just found out your tax bill is due in 3 weeks. React.",
    "You're explaining the importance of a good savings account to a kid. React.",
    "SpongeBob suggests we get a pool for the office. React.",
    "You just got a job offer at a competing business. React.",
    "You're explaining why you don't pay for cell phone plans. React.",
    "Your business partner just spent $200 on 'marketing materials'. React.",
    "You're telling a story about the time you negotiated a 5% discount. React.",
    "Someone just said 'money can't buy happiness'. React.",
    "You're explaining your retirement plan to a financial advisor. React.",
    "You just got a speeding ticket for $250. React.",
    "You're giving advice to a young entrepreneur. React.",
]

TECH_TOPICS = [
    "What is a CPU and why does it cost money?",
    "Explain RAM like you're explaining it to an employee who just got it wrong.",
    "Why do you need to back up your data?",
    "What's the difference between a router and a switch? Keep it short.",
    "Explain what a server is to someone who just says 'it's a computer'.",
    "What is an IP address?",
    "Why should I use HTTPS instead of HTTP?",
    "Explain what a hard drive failure means for business.",
    "What's the difference between a website and a web app?",
    "Explain DNS to someone who just says 'it's the internet phone book'.",
    "What is a VPN and why does it matter?",
    "Explain what a database is.",
    "Why do I need a firewall?",
    "What's the difference between LAN and WAN?",
    "Explain what a server crash means for your customers.",
    "What is a backup and why is it important for small business?",
    "Explain what a cloud is in simple terms.",
    "What's the difference between local and cloud storage?",
    "Why do I need to update my software?",
    "Explain what a password manager is.",
    "What is a DNS record and why does it cost money to buy a domain?",
    "Explain what a web server does.",
    "Why do I need a load balancer if I run multiple servers?",
    "What is a container and why would I use one?",
    "Explain what a CDN is.",
    "What is a certificate authority and why does it matter?",
    "Explain what a DDoS attack is in plain English.",
    "Why should I keep my operating system updated?",
    "What is a virtual private network for, in business terms?",
    "Explain what a server rack is and why it costs what it costs.",
]

# Prompts that stress-test the model's ability to stay in character while
# actually answering a question.
TECH_QA_TOPICS = [
    "Explain what RAM does, in your voice, with an analogy I can understand.",
    "A customer asked why my website is slow. Give me the 3 most likely reasons, in your voice.",
    "Explain why I should never store all my data on one hard drive.",
    "What's the difference between a domain name and a web hosting server? Explain it to me.",
    "Explain what a 'cloud' actually is, since nobody I talk to can do it.",
    "Why do you think most small businesses don't back up their data? Be honest.",
    "Explain what a firewall does without using the word 'traffic'.",
    "A new employee asked 'why do we need a server if we have computers?' Give them the answer, in your voice.",
    "Explain why buying the cheapest server is the most expensive mistake a small business can make.",
    "Give me 3 reasons why my website needs a proper domain name instead of an IP address.",
    "Explain what happens when a hard drive fails, in the most dramatic way you can.",
    "A customer just asked if we should 'move to the cloud'. What 3 questions do I ask them before saying yes?",
    "Explain what a load balancer does using a restaurant analogy.",
    "Why do you think most people don't understand what a VPN actually does? Explain what it does and doesn't do.",
    "A new hire asked 'what's the difference between a server and a cloud?' Give the answer in your voice.",
    "Explain why I need a backup strategy before I get a security breach, not after.",
    "Give me the 3 cheapest ways to make a small website faster.",
    "A customer asked why their password matters. Give them the answer, in your voice, without sounding like a textbook.",
    "Explain what a DNS zone file is to someone who just says 'it's where the names live'.",
    "Why do I need a separate database server instead of putting everything on one machine?",
]

# Greeting / small talk scenarios to round out the persona
SMALLTALK = [
    "Hey, how's your day going?",
    "What are you doing today?",
    "What's your favorite part of the day?",
    "How's business treating you?",
    "What's your take on this economy?",
    "You look tired. What's up?",
    "What are your plans for the weekend?",
    "What do you think about the price of krabby patties these days?",
    "What's the best piece of money advice you ever got?",
    "What's your opinion on paying in cash vs. card?",
]


def all_prompts() -> List[str]:
    """Return a large pool of prompts. Caller decides how many to use."""
    # Repeat and rotate so we get past the initial topic list
    base = GENERAL_TOPICS + TECH_TOPICS + TECH_QA_TOPICS + SMALLTALK
    # Pad with variations
    expanded = []
    for topic in base:
        expanded.append(topic)
        # Add a follow-up variant
        expanded.append("Follow up: " + topic)
    return expanded


def ollama_chat(model: str, messages: List[Dict[str, str]],
                temperature: float = 0.9, max_tokens: int = 300) -> Optional[str]:
    """Call Ollama /api/chat. Returns the assistant content or None on error."""
    url = f"{OLLAMA_HOST}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    }
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("message", {}).get("content", "").strip()
    except Exception as e:
        print(f"  [warn] Ollama call failed: {e}", file=sys.stderr)
        return None


def generate_batch(prompts: List[str], model: str, system: str,
                   dry_run: bool = False, temperature: float = 0.9) -> List[Dict[str, list]]:
    """Generate (user, assistant) pairs for each prompt."""
    out = []
    for i, prompt in enumerate(prompts):
        if (i + 1) % 50 == 0:
            print(f"  progress: {i+1}/{len(prompts)}")
        if dry_run:
            out.append({
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": "(dry run — replace with real output)"},
                ]
            })
            continue
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]
        response = ollama_chat(model, messages, temperature=temperature)
        if response is None or len(response) < 10:
            print(f"  [skip] short/failed response for: {prompt[:60]!r}", file=sys.stderr)
            continue
        out.append({
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": response},
            ]
        })
        time.sleep(0.2)  # gentle rate limiting
    return out


def main():
    parser = argparse.ArgumentParser(description="Generate Krabs persona fine-tune data via Ollama.")
    parser.add_argument("--target", type=int, default=500, help="Target number of examples")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help="Ollama model name")
    parser.add_argument("--out", type=str, default="data/train.jsonl", help="Output JSONL path")
    parser.add_argument("--temperature", type=float, default=0.9, help="Sampling temperature")
    parser.add_argument("--dry-run", action="store_true", help="No API calls; write placeholder data")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)

    print(f"Model:        {args.model}")
    print(f"Target:       {args.target} examples")
    print(f"Output:       {args.out}")
    print(f"Ollama host:  {OLLAMA_HOST}")
    print(f"Dry run:      {args.dry_run}")
    print()

    prompts = all_prompts()
    # Cycle through the pool until we hit the target
    selected = []
    for i in range(args.target):
        selected.append(prompts[i % len(prompts)])

    print(f"Generating {len(selected)} examples...")
    print()
    examples = generate_batch(selected, args.model, SYSTEM_PROMPT,
                             dry_run=args.dry_run,
                             temperature=args.temperature)

    with open(args.out, "w") as f:
        for ex in examples:
            f.write(json.dumps(ex) + "\n")

    print(f"\nWrote {len(examples)} examples to {args.out}")
    print("First 3 examples:")
    for ex in examples[:3]:
        print(json.dumps(ex, indent=2))
        print("---")


if __name__ == "__main__":
    main()
