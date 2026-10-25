# Contributing to DDX Downloader

Thank you for your interest in contributing to **DDX Downloader**! We welcome community contributions, bug reports, and feature proposals.

---

## 🧭 Code of Conduct

Please treat all community members with respect, dignity, and openness. Collaboration and constructive feedback are core tenets of this project.

---

## 🛠 Development Workflow

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-username/DdxDownloader.git
   cd DdxDownloader
   ```

2. **Branching Model**:
   - Create a feature branch from `main`:
     ```bash
     git checkout -b feature/your-feature-name
     ```
   - For bugfixes:
     ```bash
     git checkout -b fix/issue-description
     ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run Dev Environment**:
   ```bash
   npm run dev
   ```

5. **Run Tests & Linters**:
   Ensure all tests and type checks pass before submitting your Pull Request:
   ```bash
   npm run typecheck
   npm run test
   ```

---

## 📝 Commit Conventions

We follow clear and descriptive commit messages:
- `feat: add subtitle language filter to URL analysis`
- `fix: resolve filename sanitization on Windows paths`
- `docs: update packaging instructions for portable builds`
- `test: add queue retry and cancel unit tests`

---

## 📬 Submitting a Pull Request

1. Ensure your code satisfies all security constraints:
   - No untrusted shell interpolation.
   - Strictly validate all renderer IPC arguments.
   - Avoid remote backend/telemetry dependencies.
2. Open a Pull Request against the `main` branch with a clear summary of changes and test steps.
