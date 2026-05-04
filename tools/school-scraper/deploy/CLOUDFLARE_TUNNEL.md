# Exposing the Pi to Alexa via Cloudflare Tunnel

Alexa Custom Skills require a public HTTPS endpoint. The Pi sits on your home
network, so we use a Cloudflare Tunnel (free, no port forwarding, no public IP
needed).

## Prereqs

- A domain on Cloudflare (free tier is fine; transfer or register one).
- The Pi running `schoolscraper serve` on `localhost:8765`.

## Steps

### 1. Install `cloudflared` on the Pi

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
    -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

(Use `cloudflared-linux-armhf` if you're on a 32-bit Pi OS.)

### 2. Create the tunnel

In the Cloudflare dashboard:

1. **Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Choose **Cloudflared**, name it `schoolscraper`.
3. Copy the install token shown — that's your `CLOUDFLARE_TUNNEL_TOKEN`.
4. Add a public hostname:
   - **Subdomain**: `study` (or whatever)
   - **Domain**: pick your Cloudflare-managed domain
   - **Service type**: HTTP
   - **URL**: `localhost:8765`

Your Alexa endpoint will be `https://study.your-domain.com/alexa`.

### 3. Run cloudflared as a service

```bash
sudo useradd --system --home /var/lib/cloudflared --shell /usr/sbin/nologin cloudflared
sudo mkdir -p /etc/schoolscraper
echo "CLOUDFLARE_TUNNEL_TOKEN=<paste-the-token>" | sudo tee /etc/schoolscraper/cloudflared.env
sudo chmod 0640 /etc/schoolscraper/cloudflared.env
sudo cp /opt/schoolscraper/deploy/cloudflared.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
```

### 4. Test

```bash
curl https://study.your-domain.com/health
# {"ok": true, "version": "0.2.0"}
```

### 5. Restrict to Alexa (optional but recommended)

In Cloudflare Zero Trust → Access → Applications, you can add a policy for
`study.your-domain.com/alexa` that allows only Amazon's Alexa source IPs.
Otherwise the skill manifest's `applicationId` check inside the app provides
basic protection.

## Alternatives

- **ngrok** — works for testing but the URL changes; not great for a real
  Alexa skill.
- **Lambda forwarder** — host the skill in AWS Lambda and have it call your
  Pi via tunnel. Useful if you want zero direct exposure.
- **Notify Me skill** — one-way only (skill announces upcoming work) and
  doesn't require any inbound exposure. See the README for that path.
