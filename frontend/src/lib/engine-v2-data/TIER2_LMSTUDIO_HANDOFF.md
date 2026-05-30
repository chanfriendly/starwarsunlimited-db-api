# Tier-2 Local Model — Mac mini / LM Studio Setup Runbook

**Audience:** the Claude Code instance running on the Mac mini (`mini`, always-on host, Tailscale `100.86.93.118`).
**Goal:** stand up a local LLM in **LM Studio** with an OpenAI-compatible server that can emit **schema-constrained JSON**, so the Twin Suns L4 pipeline can turn SWU card rules text into engine-v2 ability-AST. You are **only** setting up + verifying the model server. The generation harness (prompt + AST JSON-schema + validate loop) is built separately in the repo and will call your server.

**Credentials:** not required for this task — LM Studio is a local desktop app. Don't pull anything from Bitwarden for this.

**Safety / scope:**
- Do **not** expose the LM Studio server to the public internet. Localhost + Tailscale only.
- Do **not** touch other homelab services (TrueNAS Docker, Home Assistant, media). This is self-contained on the mini.
- No destructive operations. If something needs a GUI click you can't do headlessly, stop and report what's needed.

---

## Why this exists (context)

The card translator already handles stats + keywords; a deterministic template matcher (Tier 1) covers ~18% of cards (mostly vanilla/keyword). The remaining ~82% are diverse ability text that needs an LLM to map into the engine's **closed** AST vocabulary. Output is validated against that vocabulary by an existing validator before it's trusted — so the model doesn't need to be perfect, it needs to be *constrainable to valid JSON* and *good enough that the validator + a human review catch the rest*. That's why **structured output (JSON schema constraint) is the make-or-break requirement** here, not raw model size.

---

## Steps

### 1. Confirm / install LM Studio
- Check if LM Studio is installed (Applications, or `ls /Applications | grep -i "LM Studio"`).
- If not, download the macOS build from https://lmstudio.ai and install. Report the version.
- LM Studio ships a CLI, `lms`. After install, confirm: `lms version`. If `lms` isn't on PATH, run LM Studio once (GUI) — it installs the CLI — or invoke from `~/.lmstudio/bin/lms`.

### 2. Download a model
Pick the **largest capable instruct model that runs comfortably** in the mini's RAM with room to spare (leave headroom — this box is also the always-on Claude Code host; don't starve it).
- **First choice:** `qwen2.5-7b-instruct` (GGUF, quant `Q4_K_M` or `Q5_K_M`). Strong at structured output, ~5–6 GB at Q4.
- **If the mini has ≥32 GB RAM and headroom:** try `qwen2.5-14b-instruct` (Q4_K_M, ~9 GB) — better at gnarly card text.
- Via CLI: `lms get qwen2.5-7b-instruct` (or download in the GUI). Report exact model id + quant chosen.

> Report back the mini's total RAM and roughly how much is free, so we can decide 7B vs 14B.

### 3. Start the OpenAI-compatible server
- Start the server (GUI: Developer → "Start Server"; or CLI `lms server start`). Default port is **1234**.
- Load the model into the server (`lms load qwen2.5-7b-instruct` or select in GUI).
- Confirm the endpoint responds: `curl http://localhost:1234/v1/models` should list the loaded model.

### 4. Verify schema-constrained JSON (the critical check)
LM Studio supports `response_format: { type: "json_schema", json_schema: { ... } }` on its `/v1/chat/completions` endpoint for llama.cpp/MLX engines. Confirm it actually constrains output:

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-7b-instruct",
    "messages": [
      {"role":"system","content":"You output only JSON matching the schema."},
      {"role":"user","content":"Card text: \"When Played: Deal 2 damage to an enemy unit.\" Produce the ability."}
    ],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "ability",
        "strict": true,
        "schema": {
          "type": "object",
          "additionalProperties": false,
          "required": ["type","on","do"],
          "properties": {
            "type": {"const": "triggered"},
            "on": {"type":"string"},
            "do": {
              "type":"object",
              "additionalProperties": false,
              "required": ["effect","amount"],
              "properties": {
                "effect": {"const":"damage"},
                "amount": {"type":"integer"}
              }
            }
          }
        }
      }
    },
    "temperature": 0
  }'
```

**Pass criteria:** the response `content` is valid JSON conforming to the schema (e.g. `{"type":"triggered","on":"event.card_played","do":{"effect":"damage","amount":2}}`). If the model returns prose or malformed JSON, structured output isn't working — try a different model/engine (MLX builds and recent llama.cpp GGUFs support it best) and report what you tried.

### 5. Reachability for the harness
The harness may run on the mini itself or call in over Tailscale.
- Localhost works if the harness runs on the mini.
- For remote calls, confirm the server is reachable at `http://100.86.93.118:1234/v1` over Tailscale (LM Studio may bind localhost only by default — enable "Serve on Local Network" / bind `0.0.0.0` in server settings if needed). **Tailscale only — do not port-forward 1234 on the router.**

---

## Report back

Reply with:
1. LM Studio version + `lms` CLI working? (y/n)
2. Model id + quant loaded; mini total RAM + free RAM.
3. `curl /v1/models` output (confirms server up).
4. **Did the step-4 schema-constrained call return valid conforming JSON?** Paste the raw `content`.
5. Rough throughput (tokens/sec) from the step-4 call — informs batch sizing for 2000 cards.
6. Server URL the harness should use (localhost vs Tailscale).
7. Anything that needed a GUI click or didn't work headlessly.

Once this is confirmed, the repo-side harness (`engine-v2-data`, built next) will: read each unmatched card from `swu_cards.db`, send `{card text + the full AST JSON-schema + few-shot examples}`, take the model's JSON, run it through `validateCardSpec`, and write specs for the ones that pass — flagging the rest for human review.
