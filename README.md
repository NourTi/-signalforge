# SignalForge Public Site

This repository contains the public SignalForge landing site. It is intentionally static and deploys through GitHub Pages from the `main` branch.

## Architecture

GitHub Pages hosts this professional public marketing page only. It does not host the secure SignalForge application server, database, encrypted credential handling, SMTP delivery, public-business discovery, or user accounts. Those capabilities require a server-side deployment.

The public site has no Manus-branded URL and contains no link to the private app URL. Its private-beta call to action opens an email to `rafaraf201@gmail.com`.

## Deployment

After GitHub Pages is enabled from the `main` branch / root folder, the page will be available at:

`https://nourti.github.io/signalforge/`

For a branded address later, set a custom domain in the repository’s GitHub Pages settings and add the required DNS records with the domain provider.
