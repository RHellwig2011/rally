# Alexa Skill: Study Buddy

This directory contains the artifacts for a custom Alexa Skill that talks to
the schoolscraper service running on your Pi.

## Files

| File | Where it goes |
|------|----------------|
| `skill-manifest.json` | Alexa Developer Console -> Build -> JSON Editor (the manifest tab) |
| `interaction-model.json` | Alexa Developer Console -> Build -> Interaction Model -> JSON Editor |

## One-time setup

1. Sign in at <https://developer.amazon.com/alexa/console/ask>.
2. **Create Skill**:
   - Skill name: **Study Buddy**
   - Default language: **English (US)**
   - Choose a model: **Custom**
   - Hosting: **Provision your own** (we host the backend on the Pi).
3. After creation, paste `skill-manifest.json` into the manifest editor.
   - Replace `https://REPLACE-WITH-YOUR-CLOUDFLARE-HOST/alexa` with the public
     hostname of your Cloudflare Tunnel (see `deploy/CLOUDFLARE_TUNNEL.md`).
4. Paste `interaction-model.json` into the Interaction Model JSON Editor.
5. Click **Save Model** then **Build Model**.
6. **Endpoint** tab -> HTTPS -> paste the same Cloudflare URL.
   - SSL certificate: **My development endpoint is a sub-domain of a domain
     that has a wildcard certificate from a certificate authority.**
7. **Test** tab -> enable **Development**.

## Wire it to the Pi

Copy the **Skill ID** from the Alexa Developer Console (e.g.
`amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) and put it in
`/etc/schoolscraper/schoolscraper.env`:

```
ALEXA_SKILL_ID=amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Then restart the service:

```bash
sudo systemctl restart schoolscraper
```

## Keep the StudentName slot in sync

Each time you add or remove a student, regenerate the interaction model so
Alexa knows who's in your household:

```bash
schoolscraper alexa-model > interaction-model.json
```

Then paste the new contents into the Alexa Developer Console and rebuild the
model. (This step only matters for slot resolution accuracy — recognition
still mostly works without it.)

## Try it

- "Alexa, open Study Buddy"
- "Alexa, ask Study Buddy what's due this week"
- "Alexa, ask Study Buddy what tests Bob has tomorrow"
- "Alexa, ask Study Buddy what should Alice study"
