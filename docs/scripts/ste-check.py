#!/usr/bin/env python3
"""
ste-check.py — STE (ASD-STE100 Issue 9) linter for BeckCloud docs.

Checks the 10 hard rules from docs/Writing-Standard.md.
Catches mechanical violations. Judgment calls (idioms, consistency,
pronoun ambiguity) are manual.

Usage:
    python3 ste-check.py <file-or-dir> [<file-or-dir> ...]
    python3 ste-check.py --all          # scan docs/**/*.md
    python3 ste-check.py --fix-report   # (future) auto-fix safe violations

Exit code: 1 if any FAIL, 0 if clean (warns only).
"""

import re
import sys
import os
from pathlib import Path

# --- Configuration -----------------------------------------------------------

PROCEDURAL_MAX = 20   # imperative sentences
DESCRIPTIVE_MAX = 25  # descriptive sentences

# Phrasal verbs that are NOT STE-approved.
# Match verb + particle when they form a phrasal verb meaning.
PHRASAL_VERBS = [
    (r"\bput out\b", "put out → extinguish"),
    (r"\bput on\b", "put on → use (or) put on (only for clothing)"),
    (r"\bput in\b", "put in → install"),
    (r"\bput up\b", "put up → install"),
    (r"\bput together\b", "put together → assemble"),
    (r"\bgive off\b", "give off → release"),
    (r"\bgive up\b", "give up → stop"),
    (r"\bgive out\b", "give out → distribute"),
    (r"\bfigure out\b", "figure out → determine"),
    (r"\blook up\b", "look up → search"),
    (r"\blook into\b", "look into → investigate"),
    (r"\blook after\b", "look after → maintain"),
    (r"\bfind out\b", "find out → determine"),
    (r"\bturn on\b", "turn on → operate (or) start"),
    (r"\bturn off\b", "turn off → stop"),
    (r"\bturn up\b", "turn up → increase"),
    (r"\bturn down\b", "turn down → decrease"),
    (r"\bbreak down\b", "break down → fail (or) stop working"),
    (r"\bbreak up\b", "break up → stop"),
    (r"\bbreak into\b", "break into → enter (force)"),
    (r"\bset up\b", "set up → install (or) prepare"),
    (r"\bset out\b", "set out → start (a journey)"),
    (r"\bbring up\b", "bring up → mention"),
    (r"\bbring down\b", "bring down → decrease"),
    (r"\bbring in\b", "bring in → add"),
    (r"\bbring out\b", "bring out → release"),
    (r"\bcome up\b", "come up → occur"),
    (r"\bcome out\b", "come out → release"),
    (r"\bcome on\b", "come on → start"),
    (r"\bcome in\b", "come in → enter"),
    (r"\bcome up with\b", "come up with → create"),
    (r"\bcome across\b", "come across → find (by chance)"),
    (r"\bend up\b", "end up → finish (in a state)"),
    (r"\bend up with\b", "end up with → have (as a result)"),
    (r"\bgo on\b", "go on → continue"),
    (r"\bgo off\b", "go off → explode (or) start"),
    (r"\bgo out\b", "go out → stop working"),
    (r"\bgo up\b", "go up → increase"),
    (r"\bgo down\b", "go down → decrease"),
    (r"\bgo in\b", "go in → enter"),
    (r"\bgo over\b", "go over → review"),
    (r"\bgo back\b", "go back → return"),
    (r"\bgo ahead\b", "go ahead → continue"),
    (r"\bgo through\b", "go through → experience (or) review"),
    (r"\bgo without\b", "go without → be without"),
    (r"\bwork out\b", "work out → determine (or) exercise"),
    (r"\bwork up\b", "work up → increase"),
    (r"\bwork on\b", "work on → maintain (or) repair"),
    (r"\bwork in\b", "work in → add"),
    (r"\bwork around\b", "work around → avoid"),
    (r"\bwork at\b", "work at → do (a job)"),
    (r"\bwork for\b", "work for → be employed by"),
    (r"\bwork with\b", "work with → use (or) cooperate with"),
    (r"\bwork through\b", "work through → process"),
    (r"\bwork toward\b", "work toward → aim for"),
    (r"\bwork down\b", "work down → decrease"),
    (r"\bpoint out\b", "point out → show"),
    (r"\bpoint to\b", "point to → show (or) indicate"),
    (r"\bpoint at\b", "point at → show"),
    (r"\bpoint in\b", "point in → direct"),
    (r"\bpoint up\b", "point up → show (upward)"),
    (r"\bbring up\b", "bring up → mention"),
    (r"\bshow up\b", "show up → appear"),
    (r"\bshow off\b", "show off → display"),
    (r"\bshow in\b", "show in → introduce"),
    (r"\bshow out\b", "show out → introduce (to leave)"),
    (r"\bfill in\b", "fill in → complete (a form)"),
    (r"\bfill out\b", "fill out → complete (a form)"),
    (r"\bfill up\b", "fill up → fill"),
    (r"\bfill on\b", "fill on → add"),
    (r"\bmake up\b", "make up → create (or) compose"),
    (r"\bmake out\b", "make out → understand"),
    (r"\bmake in\b", "make in → produce"),
    (r"\bmake for\b", "make for → go toward"),
    (r"\bmake on\b", "make on → add (to)"),
    (r"\bmake after\b", "make after → follow"),
    (r"\btake up\b", "take up → start (a hobby)"),
    (r"\btake out\b", "take out → remove"),
    (r"\btake in\b", "take in → receive"),
    (r"\btake on\b", "take on → employ (or) accept"),
    (r"\btake off\b", "take off → remove (or) depart"),
    (r"\btake over\b", "take over → assume control"),
    (r"\btake after\b", "take after → resemble"),
    (r"\btake back\b", "take back → return"),
    (r"\btake down\b", "take down → remove (or) write"),
    (r"\btake away\b", "take away → remove"),
    (r"\btake in with\b", "take in with → include"),
    (r"\bhold up\b", "hold up → delay"),
    (r"\bhold on\b", "hold on → wait"),
    (r"\bhold out\b", "hold out → resist"),
    (r"\bhold back\b", "hold back → restrain"),
    (r"\bhold down\b", "hold down → keep (in a position)"),
    (r"\bhold in\b", "hold in → keep (inside)"),
    (r"\bcarry on\b", "carry on → continue"),
    (r"\bcarry out\b", "carry out → do"),
    (r"\bcarry over\b", "carry over → postpone"),
    (r"\bcarry in\b", "carry in → bring"),
    (r"\bcarry down\b", "carry down → transmit"),
    (r"\bcarry up\b", "carry up → transmit (upward)"),
    (r"\bcarry for\b", "carry for → support"),
    (r"\bcarry with\b", "carry with → bring (along)"),
    (r"\bpass on\b", "pass on → continue (or) transmit"),
    (r"\bpass out\b", "pass out → lose consciousness"),
    (r"\bpass up\b", "pass up → refuse"),
    (r"\bpass over\b", "pass over → ignore"),
    (r"\bpass in\b", "pass in → enter"),
    (r"\bpass for\b", "pass for → be accepted as"),
    (r"\bpass under\b", "pass under → go below"),
    (r"\bpass through\b", "pass through → go through"),
    (r"\bmove on\b", "move on → continue"),
    (r"\bmove out\b", "move out → leave"),
    (r"\bmove in\b", "move in → enter"),
    (r"\bmove up\b", "move up → advance"),
    (r"\bmove down\b", "move down → go back"),
    (r"\bmove over\b", "move over → shift"),
    (r"\bmove in with\b", "move in with → live with"),
    (r"\bmove back\b", "move back → return"),
    (r"\bmove forward\b", "move forward → advance"),
    (r"\bmove along\b", "move along → proceed"),
    (r"\bmove toward\b", "move toward → go toward"),
    (r"\bmove away\b", "move away → leave"),
    (r"\bmove around\b", "move around → move (in various directions)"),
    (r"\bmove in for\b", "move in for → take the place of"),
]

# Latin abbreviations that are NOT STE-approved.
LATIN_ABBREV = [
    (r"\be\.g\.", "e.g. → for example"),
    (r"\bi\.e\.", "i.e. → that is"),
    (r"\betc\.", "etc. → (omit or list all items)"),
    (r"\bviz\.", "viz. → namely"),
    (r"\bca\.\s", "ca. → approximately"),
    (r"\bop\.cit\.", "op.cit. → (omit)"),
    (r"\bcf\.", "cf. → compare"),
]

# Known-approved abbreviations (house list, extend as needed).
KNOWN_ABBREVS = {
    # Standard
    "K8s", "Kubernetes", "SSO", "PVC", "PV", "POD", "PODS",
    "TLS", "HTTPS", "HTTP", "API", "URL", "URI", "DNS",
    "LDAP", "OIDC", "OAuth", "JWT",
    "CPU", "RAM", "SSD", "HDD", "USB", "PCI", "PCIe",
    "ID", "UI", "UX", "CLI", "GUI",
    "IP", "LAN", "WAN", "VLAN", "NAT", "DHCP",
    "SQL", "ORM", "CRUD",
    "CI", "CD", "GIT", "SSH", "SCP",
    "ISO", "OSI", "TCP", "UDP", "ICMP",
    "VM", "VPS", "IOPS",
    "AC", "DC",
    "SOP", "RFC",
    "SRE", "GRC", "SOC",
    "LLM", "AI", "ML",
    "NVIDIA", "CUDA", "CUDNN",
    "GPGPU",
    "HBA", "RAID",
    "LVM", "ZFS", "BTRFS", "EXT4",
    "SELinux", "AppArmor",
    "Ceph", "Rook",
    # Services
    "Velero", "Flux", "Traefik", "Cilium",
    "Keycloak", "LLDAP", "OAuth2",
    "Redis", "PostgreSQL", "MySQL", "MongoDB",
    "MinIO",
    "Jellyfin", "Sonarr", "Radarr", "Prowlarr", "Bazarr",
    "SABnzbd", "nzbget", "qBittorrent", "Gluetun",
    "Tdarr", "Homebox", "Jellyseerr",
    "Grafana", "Prometheus",
    "Crafty", "Minecraft",
    "Affine", "Directus",
    "Kaniko", "Docker", "Podman",
    "Ansible", "Helm", "Kustomize",
    "SOPS", "age", "GPG",
    "GitHub", "GitLab", "Bitbucket",
    "GHCR", "DockerHub", "Quay",
    "OpenNebula", "Sunstone", "FireEdge",
    "Hubble",
    "Swiparr",
    "Wazuh", "Falco", "Suricata", "Trivy",
    "Crowdsec", "LAPI",
    "ToolJet",
    "Silex",
    "Homepage",
    # House-specific (these are words in our own standard, not abbreviations)
    "STE", "ASD", "STE100", "ASD100",
    "SOUL", "AGENTS", "IDENTITY", "MEMORY",
    "DOCS", "GUIDE", "REVIEW", "CHECKLIST",
    "FAIL", "WARN", "PASS",
    "NOTE", "WARNING", "CAUTION",
    "DRIFT", "ENFORCEMENT",
    "README", "CHANGELOG", "LICENSE",
}

# Words that are NOT abbreviations (common all-caps words in tech docs)
NOT_ABBREVS = {
    "NOT", "THE", "AND", "OR", "BUT", "FOR", "ARE",
    "IS", "BE", "IN", "ON", "AT", "BY", "TO", "OF",
    "WITH", "FROM", "INTO", "UP", "DOWN", "OUT", "OFF",
    "ALL", "ANY", "NO", "YES", "DO", "DONE",
    "CAN", "MAY", "WILL", "SHOULD", "MUST", "COULD", "WOULD",
    "DOES", "DID", "HAS", "HAD", "HAVE", "HAVING",
    "THIS", "THAT", "WHICH", "WHO", "WHAT", "WHEN", "WHERE",
    "HOW", "WHY", "IF", "THEN", "ELSE", "BECOME",
    "MADE", "MAKE", "MAKES", "MADE", "TAKE", "TAKEN",
    "GIVE", "GIVEN", "KNOW", "KNOWN", "KNOWS",
    "USE", "USED", "USING", "GET", "GOT", "GETS",
    "SAY", "SAID", "SAYS", "PUT", "PUTS", "PUTTING",
    "SET", "SETS", "SETTLE", "SETTLED",
    "RUN", "RUNS", "RUNNING", "LET", "LETS", "LEAVING",
    "GROW", "GROWS", "GROWING", "FALL", "FALLS", "FALLING",
    "HOLD", "HOLDS", "HELD", "KEEP", "KEEPS", "KEPT",
    "LEAVE", "LEAVES", "LEFT", "TELL", "TELLS", "TELLING",
    "TOLD", "SPEND", "SPENTS", "SPENT", "FIND", "FINDS", "FOUND",
    "THINK", "THINKS", "THOUGHT", "SPEAK", "SPEAKS", "SPOKE",
    "SPOKEN", "CATCH", "CATCHES", "CAUGHT", "LEAD", "LEADS", "LED",
    "BUILT", "BUILD", "BUILDS", "BURN", "BURNS", "BURNING", "BURNT",
    "BROKE", "BREAK", "BREAKS", "BRING", "BRINGS", "BROUGHT",
    "CHOSE", "CHOOSE", "CHOOSES", "CHOSEN", "DROVE", "DRIVE",
    "DRIVES", "DRIVEN", "EAT", "EATS", "ATE", "EATEN",
    "FLEW", "FLY", "FLIES", "FLEW", "FOUGHT", "FIGHT", "FIGHTS",
    "FELL", "FEEL", "FEELS", "FEELING", "FELT", "FOKED",
    "FORGET", "FORGETS", "FORGOT", "FORGOTTEN", "FOUND", "FROZE",
    "FREEZE", "FREEZES", "FREEZING", "GROW", "GREW", "GROWN",
    "HUNG", "HANG", "HANGS", "HANGING", "HEARD", "HEAR", "HEARS",
    "HEARING", "HID", "HIDE", "HIDES", "HIDDEN", "HIT", "HITS",
    "HOLD", "HOLDS", "HELD", "KEPT", "KNEW", "KNOW", "KNOWS",
    "KNOWN", "LAIN", "LIE", "LIES", "LAY", "LAYS", "LIED", "LYING",
    "LOST", "LOSE", "LOSES", "LOSING", "MEANT", "MEAN", "MEANS",
    "MEANING", "MET", "MEET", "MEETS", "MEETING", "PAID", "PAY",
    "PAYS", "PAYING", "RAN", "RUN", "RUNS", "RUNNING", "SAT",
    "SIT", "SITS", "SITTING", "SOLD", "SELL", "SELLS", "SELLING",
    "SENT", "SEND", "SENDS", "SENDING", "SET", "SETS", "SETTLE",
    "SHOT", "SHOOT", "SHOOTS", "SHOOTING", "SLEPT", "SLEEP", "SLEEPS",
    "SLEEPING", "SPOKE", "SPEAK", "SPEAKS", "SPEAKING", "SPENT",
    "SPEND", "SPENDS", "SPENDING", "STAND", "STANDS", "STOOD", "STOOD",
    "STANDING", "STEAL", "STEALS", "STOLE", "STOLEN", "STUCK", "STICK",
    "STICKS", "STICKING", "SWAM", "SWIM", "SWIMS", "SWIMMING",
    "SUNG", "SING", "SINGS", "SINGING", "SAT", "SIT", "SITS",
    "SITTING", "SAW", "SEE", "SEES", "SEEING", "SEEN", "SLAIN",
    "SLAY", "SLAYS", "SLAYING", "SMOTE", "SMITE", "SMITES", "SMITING",
    "SOUGHT", "SEEK", "SEEKS", "SEEKING", "SPOKE", "SPEAK", "SPEAKS",
    "SPEAKING", "SPUN", "SPIN", "SPINS", "SPINNING", "SLEPT", "SLEEP",
    "SLEEPS", "SLEEPING", "SPREAD", "SPREAD", "SLEW", "SLAY",
}

# Safety callout words (not abbreviations, they are STE terms)
SAFETY_WORDS = {
    "WARNING", "CAUTION", "NOTE",
}

# --- Helpers -----------------------------------------------------------------

def is_code_block(line: str) -> bool:
    """Check if a line is inside a fenced code block."""
    stripped = line.strip()
    return stripped.startswith("```") or stripped.startswith("~~~")


def in_code_block(lines: list[str], idx: int) -> bool:
    """Check if line at idx is inside a fenced code block."""
    in_block = False
    for i in range(idx):
        if is_code_block(lines[i]):
            in_block = not in_block
    return in_block


def strip_markdown(line: str) -> str:
    """Remove markdown formatting from a line for analysis."""
    # Remove inline code
    line = re.sub(r"`[^`]*`", "", line)
    # Remove links, keep text
    line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)
    # Remove bold/italic
    line = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", line)
    # Remove headings
    line = re.sub(r"^#{1,6}\s*", "", line)
    # Remove list markers
    line = re.sub(r"^\s*[-*\d+]\s+", "", line)
    # Remove blockquotes
    line = re.sub(r"^>\s?", "", line)
    return line.strip()


def count_words(text: str) -> int:
    """Count words per STE rules 8.4-8.7."""
    # Remove markdown
    text = strip_markdown(text)
    if not text:
        return 0
    # Split on whitespace
    words = text.split()
    return len(words)


def split_sentences(text: str) -> list[str]:
    """Split text into sentences on ., !, ?"""
    # Remove markdown
    text = strip_markdown(text)
    if not text:
        return []
    # Split on sentence-ending punctuation
    # But don't split on abbreviations (e.g., i.e., etc. — those are already caught)
    sentences = re.split(r'[.!?]+', text)
    # Filter empty
    sentences = [s.strip() for s in sentences if s.strip()]
    return sentences


def is_imperative(sentence: str) -> bool:
    """Heuristic: is this an imperative (procedural) sentence?"""
    sentence = strip_markdown(sentence).strip()
    if not sentence:
        return False
    # Check if it's a numbered step
    if re.match(r"^\d+\.", sentence):
        return True
    # Check if it starts with a common imperative verb
    imperative_verbs = {
        "do", "make", "remove", "install", "check", "verify",
        "start", "stop", "restart", "delete", "create", "update",
        "apply", "run", "execute", "add", "edit", "modify",
        "change", "set", "get", "find", "look", "use", "open",
        "close", "connect", "disconnect", "enable", "disable",
        "configure", "deploy", "scale", "patch", "label",
        "annotate", "examine", "measure", "test", "confirm",
        "ensure", "guarantee", "prevent", "avoid", "keep",
        "maintain", "monitor", "review", "inspect", "audit",
        "back up", "restore", "migrate", "upgrade", "downgrade",
        "clean", "clear", "reset", "reload", "refresh",
        "download", "upload", "copy", "move", "rename",
        "replace", "swap", "toggle", "switch", "select",
        "choose", "pick", "pick", "take", "bring", "carry",
        "pass", "send", "receive", "accept", "reject",
        "approve", "deny", "allow", "block", "filter",
        "route", "forward", "redirect", "proxy", "tunnel",
        "encrypt", "decrypt", "sign", "verify", "validate",
        "generate", "produce", "create", "build", "compile",
        "link", "load", "unload", "mount", "unmount",
        "attach", "detach", "bind", "unbind", "map",
        "allocate", "free", "release", "acquire", "obtain",
        "obtain", "request", "respond", "reply", "answer",
        "notify", "alert", "warn", "log", "record", "write",
        "read", "print", "display", "show", "hide", "reveal",
        "expose", "conceal", "mask", "unmask",
        "activate", "deactivate", "engage", "disengage",
        "arm", "disarm", "trigger", "fire", "launch",
        "initiate", "terminate", "abort", "cancel", "resume",
        "pause", "halt", "hold", "wait", "delay", "postpone",
        "schedule", "unschedule", "trigger",
        "provision", "deprovision", "provision",
        "synchronize", "sync", "reconcile", "converge",
        "drift", "diverge", "converge",
        "commit", "push", "pull", "fetch", "clone",
        "checkout", "merge", "rebase", "cherry-pick",
        "stash", "unstash", "apply", "revert",
        "tag", "branch", "switch", "reset",
    }
    first_word = sentence.split()[0].lower().rstrip(".,;:")
    return first_word in imperative_verbs


# --- Checks ------------------------------------------------------------------

class Violation:
    def __init__(self, line_no: int, level: str, rule: str, message: str, text: str = ""):
        self.line_no = line_no
        self.level = level  # FAIL or WARN
        self.rule = rule
        self.message = message
        self.text = text

    def __str__(self):
        return f"  L{self.line_no}: {self.level}  {self.rule}  {self.message}"


def check_file(filepath: str) -> list[Violation]:
    violations = []
    path = Path(filepath)
    if not path.exists() or not path.is_file():
        return violations

    content = path.read_text(encoding="utf-8", errors="replace")
    lines = content.split("\n")

    in_code = False
    in_backtick_block = False
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Track code block state
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_code = not in_code
            continue
        if in_code:
            continue

        # Track inline backtick blocks (e.g., `` `e.g.`, `i.e.` `` on a line)
        # If the line is inside a backtick-delimited span, skip checks
        in_backtick = False
        for m in re.finditer(r"`[^`]*`", line):
            in_backtick = True
            break

        # Skip empty lines, headings, horizontal rules
        if not stripped or stripped.startswith("#") or stripped.startswith("---") or stripped.startswith("==="):
            continue

        # Skip table rows (they're structured data, not prose)
        if stripped.startswith("|"):
            continue

        # Skip lines that are entirely inside backticks (code examples)
        # These are examples of what NOT to write, not actual prose
        if in_backtick:
            # Check if the line is a backtick example (e.g., `Put out the fire.`)
            # We can still check for semicolons and sentence length in backtick examples
            # but skip phrasal verbs and Latin abbreviations since those ARE the examples
            pass

        # --- Rule 2: No semicolons ---
        if ";" in line:
            # Ignore semicolons in URLs or code-like contexts
            if not re.search(r"\w+://.*;", line):
                violations.append(Violation(idx, "FAIL", "semicolon", "semicolon (use two sentences)"))

        # --- Rule 10: No Latin abbreviations ---
        # Skip if the line is a backtick example (it's showing what NOT to write)
        if in_backtick:
            pass
        else:
            for pattern, replacement in LATIN_ABBREV:
                if re.search(pattern, line, re.IGNORECASE):
                    violations.append(Violation(idx, "FAIL", "latin-abbrev", f"{replacement}"))

        # --- Rule 5: No phrasal verbs ---
        # Skip if the line is a backtick example
        if in_backtick:
            pass
        else:
            for pattern, replacement in PHRASAL_VERBS:
                if re.search(pattern, line, re.IGNORECASE):
                    violations.append(Violation(idx, "FAIL", "phrasal-verb", f"{replacement}"))

        # --- Rule 1: Sentence length ---
        # Split line into sentences and check each
        # Only check lines that look like prose (not list items, not single words)
        text = strip_markdown(line)
        if len(text) > 30:  # skip very short lines
            sentences = split_sentences(text)
            for sent in sentences:
                wc = count_words(sent)
                # Determine if procedural or descriptive
                imperative = is_imperative(sent)
                limit = PROCEDURAL_MAX if imperative else DESCRIPTIVE_MAX
                if wc > limit:
                    # Skip sentences that are inside backticks (code examples)
                    if re.search(r"`.*`", sent):
                        continue
                    violations.append(Violation(
                        idx, "FAIL", "sentence-length",
                        f"{wc} words (max {limit}, {'procedural' if imperative else 'descriptive'})"
                    ))

        # --- Rule 8: No undefined abbreviations ---
        # Find all-caps words > 2 chars, but skip common English words that
        # happen to be all-caps (THE, NOT, AND, OR, etc.) and safety callouts.
        all_caps = re.findall(r"\b([A-Z]{3,})\b", text)
        for word in all_caps:
            if word in NOT_ABBREVS:
                continue
            if word in SAFETY_WORDS:
                continue
            if word in KNOWN_ABBREVS:
                continue
            violations.append(Violation(idx, "WARN", "undefined-abbrev", f"'{word}' not in known list"))

    return violations


def check_dir(dirpath: str) -> dict[str, list[Violation]]:
    results = {}
    dir_path = Path(dirpath)
    for md_file in sorted(dir_path.rglob("*.md")):
        violations = check_file(str(md_file))
        if violations:
            results[str(md_file)] = violations
    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: ste-check.py <file-or-dir> [--all]")
        print("       ste-check.py --all")
        sys.exit(1)

    target = sys.argv[1]

    # --all: scan docs/
    if target == "--all":
        docs_dir = Path(__file__).parent.parent  # docs/
        results = check_dir(str(docs_dir))
    elif os.path.isdir(target):
        results = check_dir(target)
    else:
        results = {}
        violations = check_file(target)
        if violations:
            results[target] = violations

    # Report
    total_fail = 0
    total_warn = 0

    for filepath, violations in sorted(results.items()):
        print(f"\n{filepath}")
        for v in violations:
            print(f"  {v}")
            if v.level == "FAIL":
                total_fail += 1
            else:
                total_warn += 1

    print(f"\n{'─' * 50}")
    print(f"{len(results)} file(s) with issues, "
          f"{total_fail} FAIL, {total_warn} WARN")

    if total_fail > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
