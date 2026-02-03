# apha-apps-perms-case-mgmt-ui

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_apha-apps-perms-case-mgmt-ui&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_apha-apps-perms-case-mgmt-ui)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_apha-apps-perms-case-mgmt-ui&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_apha-apps-perms-case-mgmt-ui)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_apha-apps-perms-case-mgmt-ui&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_apha-apps-perms-case-mgmt-ui)

FrontEnd for a Case Management tool that will be used by flexible teams (including admins and vets) to view the details of customer applications and their corresponding cases
and process them by following series of pre-defined steps in order to reach a determination. Users of this tool will have the option to assign the cases to themselves
or to someone else (if their role allows that) and a case could also be escalated to a specialist for review when required. Additional information could also be requested
to the applicant and added to the case.

The cases will be retrieved and updated through a set of APIs decoupling this tool from the underlying storage solution.

This tool will be protected by Azure AD to prevent unauthorised access.

- [apha-apps-perms-case-mgmt-ui](#apha-apps-perms-case-mgmt-ui)
  - [Requirements](#requirements)
    - [Node.js](#nodejs)
  - [Server-side Caching](#server-side-caching)
  - [Redis](#redis)
  - [Proxy](#proxy)
  - [Local Development](#local-development)
    - [Setup](#setup)
    - [Development](#development)
    - [Production](#production)
    - [Npm scripts](#npm-scripts)
    - [Update dependencies](#update-dependencies)
    - [Formatting](#formatting)
      - [Windows prettier issue](#windows-prettier-issue)
  - [Docker](#docker)
    - [Development image](#development-image)
    - [Production image](#production-image)
    - [Docker Compose](#docker-compose)
    - [Dependabot](#dependabot)
    - [SonarCloud](#sonarcloud)
  - [Licence](#licence)
    - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v22` and [npm](https://nodejs.org/) `>= v9`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd apha-apps-perms-case-mgmt-ui
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Authentication (Azure AD)

- All application routes require an authenticated Azure AD session (health and static assets remain open); start the sign-in flow at `/auth/login` and end it at `/auth/logout`.
- Local development defaults to mocked federated credentials by leaving `AZURE_CREDENTIALS_ENABLE_MOCKING=true`, using the stub well-known endpoint and HTTP.
- Optional: override the Cognito developer provider name via `AZURE_CREDENTIAL_PROVIDER_NAME` (default: `apha-apps-perms-case-mgmt-ui-aad-access`).
- Example `.env` (mocked, default):
  ```
  APP_BASE_URL=http://localhost:3000
  AZURE_CREDENTIALS_ENABLE_MOCKING=true
  OIDC_WELL_KNOWN_CONFIGURATION_URL=http://localhost:3939/6f504113-6b64-43f2-ade9-242e05780007/v2.0/.well-known/openid-configuration
  AZURE_TENANT_ID=6f504113-6b64-43f2-ade9-242e05780007
  AZURE_CLIENT_ID=26372ac9-d8f0-4da9-a17e-938eb3161d8e
  ```
- Example `.env` (real Azure):
  ```
  APP_BASE_URL=http://localhost:3000
  AZURE_CREDENTIALS_ENABLE_MOCKING=false
  AZURE_IDENTITY_POOL_ID=<cognito-identity-pool-id>
  AZURE_CREDENTIAL_PROVIDER_NAME=apha-apps-perms-case-mgmt-ui-aad-access
  AZURE_TENANT_ID=<tenant-id>
  AZURE_CLIENT_ID=<client-id>
  OIDC_WELL_KNOWN_CONFIGURATION_URL=https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration
  SESSION_COOKIE_PASSWORD=please-change-me-to-a-32-characters-secret
  ```

#### APHA Integration Bridge: M2M Cognito

- Cognito M2M client credentials are required to call the Integration Bridge in local development.
- Example `.env` additions:
  ```
  APHA_INTEGRATION_BRIDGE_BASE_URL=http://localhost:5676
  APHA_INTEGRATION_BRIDGE_TOKEN_URL=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>/oauth2/token
  APHA_INTEGRATION_BRIDGE_CLIENT_ID=<client-id>
  APHA_INTEGRATION_BRIDGE_CLIENT_SECRET=<client-secret>
  ```

### APHA Integration Bridge

- Add absolute or relative path to a locally cloned [APHA Integration Bridge](https://github.com/defra/apha-integration-bridge) to `.env`:
  ```
  APHA_INTEGRATION_BRIDGE_REPO=../apha-integration-bridge
  ```
- Enable all profiles in docker compose to run a local instance of the Integration Bridge with OracleDB support in `.env`:
  ```
  COMPOSE_PROFILES=*
  ```
- Login now checks Salesforce presence by calling `POST /case-management/users/find` via the integration bridge; access is denied when no user is returned.
- Configure the client-credential flow with `APHA_INTEGRATION_BRIDGE_BASE_URL`, `APHA_INTEGRATION_BRIDGE_TOKEN_URL`, `APHA_INTEGRATION_BRIDGE_CLIENT_ID`, and `APHA_INTEGRATION_BRIDGE_CLIENT_SECRET`.
- The integration client caches Cognito access tokens in memory to avoid unnecessary token requests.
- A locally running Integration Bridge API is expected in development; set the `APHA_INTEGRATION_BRIDGE_*` variables to point at your local instance.

> When running the APHA Integration Bridge locally via Docker Compose, it runs in development mode to ensure that any changes to the API are
> reflected without needing to rebuild the Docker image. This is achieved by mounting the source code into the container.

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag apha-apps-perms-case-mgmt-ui`

Build:

```bash
docker build --target development --no-cache --tag apha-apps-perms-case-mgmt-ui:development .
```

Run:

```bash
docker run -p 3000:3000 apha-apps-perms-case-mgmt-ui:development
```

### Production image

Build:

```bash
docker build --no-cache --tag apha-apps-perms-case-mgmt-ui .
```

Run:

```bash
docker run -p 3000:3000 apha-apps-perms-case-mgmt-ui
```

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
