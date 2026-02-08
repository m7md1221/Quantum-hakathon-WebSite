# Quantum Khakathon — Simple Guide

This is a small web app for running a hackathon evaluation system. Teams submit a GitHub repository URL, judges evaluate, and admins manage the event.

This README explains how to set up and run the project, and how to fix a common database issue after upgrading.

## What is new

- Teams now submit a GitHub repository URL instead of uploading ZIP files.
- The `projects` table stores `github_url` for each team.

## Quick features (short)

- Roles: `admin`, `judge`, `team`.
- Login with JWT tokens.
- Teams submit GitHub URLs.
- Judges score projects with weighted criteria.

## Tech stack (short)

- Backend: Node.js + Express
- Database: PostgreSQL (using `pg`)
# Quantum Khakathon — Simple Guide

This is a small web application for running a hackathon evaluation system. Teams submit a GitHub repository URL, judges evaluate projects, and admins manage the event.

This README explains how to set up and run the project, and how to fix a common database issue after upgrading.

---

## What’s new

- Teams now submit a GitHub repository URL instead of uploading ZIP files.
- The `projects` table stores `github_url` for each team.

---

## Quick features (short)

- Roles: `admin`, `judge`, `team`
- Login with JWT tokens
- Teams submit GitHub URLs
- Judges score projects with weighted criteria

---

## Tech stack (short)

- Backend: Node.js + Express
- Database: PostgreSQL (using the `pg` module)
- Frontend: HTML, CSS, plain JavaScript
- Auth: JWT (`jsonwebtoken`)

---

## Quick setup (copy–paste)

1. Clone and enter the folder

```bash
git clone <repo-url>
cd "Quantum Khakathon"
```

2. Install dependencies

```bash
npm install
```

3. Add environment variables

- Create a `.env` file or copy from `.env.example` and set:
  - `DATABASE_URL` (recommended) or `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
  - `JWT_SECRET`

4. (Optional) Seed data for testing

```bash
node seed.js
```

5. Start the server

```bash
npm start
```

Open: http://localhost:3000

---

## Common database issue and fix

After updating the code, you may see this error when submitting:

```
error: column "github_url" of relation "projects" does not exist
```

If this happens, run the provided fixer script. It checks the schema and adds the new `projects` table or column.

Run (PowerShell or terminal):

```powershell
cd "C:\Users\dell\Desktop\Quantum Khakathon"
node fix_github_column.js
```

Or on Windows, double-click `fix_database.bat`.

After the script finishes, restart the server:

```bash
npm start
```

---

## How teams submit (example)

Send a POST request to `POST /api/team/submit` with JSON body:

```json
{ "github_url": "https://github.com/username/repo" }
```

The frontend `public/upload-project.html` contains the submission form and validates the URL.

---

## Important files

- `server.js` — main server file
- `routes/` — API route handlers (`team.js`, `admin.js`, `judge.js`)
- `db.js` — PostgreSQL connection
- `fix_github_column.js` — automated DB schema fixer
- `public/` — frontend files

---

## Security notes

- Keep `.env` secret. Do not commit it.
- Use a strong `JWT_SECRET`.

---

## Need a simpler Arabic version?

I can add a short Arabic Quick Start at the top if you want.

---


## Project Structure

```
├── server.js              # Main server file
├── db.js                  # Database connection
├── routes/                # API route handlers (admin, judge, team, auth)
├── public/                # Frontend files (HTML, JS, CSS)
├── migrations/            # SQL migration scripts
├── utils/                 # Utility modules
├── services/              # Business logic modules
├── seed.js                # Seed database for testing
├── fix_github_column.js   # DB schema fixer script
└── ...                    # Other scripts and docs
```

---

## Running Tests

If you have test scripts, run them with:

```bash
npm test
```
or run individual test files:
```bash
node test_admin_score_editing.js
```

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## Contact & Support

For questions or support, open an issue or contact the maintainer.

---

## License

Specify your license here (e.g., MIT, Apache-2.0). If not open source, state "All rights reserved."

---


<img width="1750" height="2504" alt="naiqhackathon inno-park co_login html(iPad)" src="https://github.com/user-attachments/assets/c0cb8350-5a59-4f11-98d5-b1f5d1500ebf" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_campus-guide html(iPad)" src="https://github.com/user-attachments/assets/9d4ed9ce-acee-486d-880f-71f63e0f13e1" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_team-dashboard html(iPad)" src="https://github.com/user-attachments/assets/e3a4b47b-776a-4e9d-b577-6e07f2bc3983" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_judge-dashboard html(iPad)" src="https://github.com/user-attachments/assets/3b01e9cb-5641-436b-be21-5d8f815f2d0e" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_admin-dashboard html(iPad)" src="https://github.com/user-attachments/assets/83dd4edc-77e4-4784-bce8-4df52e04aa46" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_admin-dashboard html(iPad) (1)" src="https://github.com/user-attachments/assets/b8bf2b3f-9770-4728-ba3e-58847fd92f2e" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_admin-dashboard html(iPad) (2)" src="https://github.com/user-attachments/assets/89ba3bda-539a-4c84-b569-ef0a173391ce" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_admin-dashboard html(iPad) (3)" src="https://github.com/user-attachments/assets/a72e0819-131e-478d-8ffe-993fc050a76b" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_admin-dashboard html(iPad) (4)" src="https://github.com/user-attachments/assets/ad383bdc-2647-4eb4-85a0-e12cd2b93046" />
<img width="1750" height="2504" alt="naiqhackathon inno-park co_results html(iPad) (1)" src="https://github.com/user-attachments/assets/8e3f6276-8d70-41df-8b74-6f4978c462c0" />

[Untitled design.pdf](https://github.com/user-attachments/files/25169927/Untitled.design.pdf)
