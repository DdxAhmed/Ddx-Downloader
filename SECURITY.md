# Security Policy

## 🛡 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## 🔒 Security Architecture & Guarantees

DDX Downloader is engineered with strict local-first security principles:
1. **Context Isolation**: Enabled by default in Electron `webPreferences`.
2. **Node Integration Disabled**: The renderer process has no direct Node.js or OS filesystem privileges.
3. **No Shell Interpolation**: All media engine processes (yt-dlp and FFmpeg) are spawned exclusively with argument arrays using `child_process.spawn`.
4. **SSRF & Private Network Protection**: URLs targeting `localhost`, `127.0.0.1`, `::1`, and private RFC1918 subnets (`192.168.*`, `10.*`, `172.16-31.*`) are systematically rejected.
5. **No Telemetry or Remote Databases**: Application database records, settings, and download history never leave the user's local machine.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability within DDX Downloader, please **do not** open a public issue.

Instead, please report it privately:
- Open a GitHub Security Advisory on the repository: **Security > Advisories > Report a vulnerability**.
- Provide a detailed explanation of the vulnerability, steps to reproduce, and impact.

We will acknowledge receipt within 48 hours and work with you to patch and publish an advisory responsibly.
