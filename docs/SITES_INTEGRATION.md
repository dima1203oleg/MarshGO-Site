# ChatGPT Sites integration status

## Observed account state

The existing Sites project is `marshgo` at `https://marshgo.dima1203gmail-com.chatgpt.site`, version 2, with **public** access and no preview URL at the time of audit. It was not edited or deployed. This repository has no `.openai/hosting.json` and is not connected to that Site's source repository.

## Supported capabilities and this project's status

| Capability | Status | Evidence / limit |
| --- | --- | --- |
| Reuse compatible local project in Sites | SUPPORTED BY PLATFORM | Official Sites documentation describes using a compatible local project. It does not itself establish a GitHub remote connection. |
| Associate local source project and Sites project ID | SUPPORTED BY PLATFORM, NOT CONFIGURED HERE | `.openai/hosting.json` can declare the Sites `project_id` and hosting config. This repository has no such file. |
| Sites version associated with source commit | SUPPORTED BY PLATFORM, NOT CONFIGURED HERE | Official docs describe saving a version against the source commit. The Sites source workflow requires pushing the exact commit to its configured source branch. |
| Direct GitHub branch tracking / automatic GitHub → Sites updates | UNSUPPORTED IN THIS SETUP | No configured source link, webhook, or supported automatic tracker was found. No experiment was made against the public Site. |
| Sites edits → canonical GitHub source | UNSUPPORTED IN THIS SETUP | The available Sites source workflow writes to the Site's configured source repository; it is not a bidirectional sync to `dima1203oleg/MarshGO-Site`. Do not create a second source of truth. |
| Local GitHub-based live preview | PASS | Vite runs the actual Site entry from this checkout; `/?studio=1` displays that app inside Design Studio. |
| Public preview or production deployment | NOT USED | The existing Site is public, and Sites deployment URLs are production. No version was saved or deployed. |
| Private Sites preview for Admin/Partner | NOT VERIFIED | No private preview has been configured. Do not publish those frontends through the public `marshgo` Site. |

The current supported workflow is local Git → local Design Studio. GitHub PRs remain the source of truth. A future Sites integration must first establish a supported source workflow that points to the canonical GitHub repository rather than maintaining a second writable copy. Never call a Sites deploy operation for this work without explicit production approval.

## Official documentation

- [ChatGPT Sites documentation](https://learn.chatgpt.com/docs/sites?surface=web) describes compatible local projects, `.openai/hosting.json`, saved versions, access controls, and the distinction between saving and deployment.
- In this account, the installed Sites connector distinguishes saving a version from deploying it and requires the pushed source commit for a saved version. That source flow has not been connected to the canonical GitHub repo.
