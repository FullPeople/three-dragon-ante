# Three-Dragon Ante

Read README.md, docs/EXTRACTION.md and docs/STATUS.md first. SOURCE.json pins the
exact source extracted from FullPeople/obr-suite. Historical documents describe
their own dates and do not override the current implementation or release receipt.

- Keep this repository independent of DND-card-web and Full Suite builds.
- Preserve rules, room/message namespaces, private database names and artwork
  attribution. Do not hot-migrate an active game or invent missing private hands.
- Rules remain pure. Transport, storage and renderers have distinct ownership.
- Public and seat projections must not contain deck order or opponents' hands.
  Omniscient information requires existing authorization and its private channel.
- Imports and actions validate before mutation; acknowledge only committed saves.
- Include no player files, account credentials, room dumps or live SQLite data.
- Test Node 22.17+ builds, privacy, controllers and service transactions. Browser
  fixtures and practice tests do not prove real Owlbear multi-account behavior.
- Windows browser tests use installed Edge; other systems use official
  Playwright Chromium. Do not require a Codex runtime or sibling repository.
- The initial extraction does not deploy or remove the existing Suite copy.
  Later publishing requires explicit user authorization for that release.
