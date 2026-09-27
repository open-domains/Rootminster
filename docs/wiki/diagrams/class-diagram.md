# Class / Type Diagram

Rootminster is mostly functional JavaScript, so this diagram shows the main service-like modules and persisted record types rather than classes.

```mermaid
classDiagram
    class FastifyApp {
        +registerAuthRoutes()
        +registerEntityRoutes()
        +registerFunctionRoutes()
        +registerPublicApiRoutes()
        +registerMcpRoutes()
    }
    class AuthService {
        +authenticateRequest(request)
        +createSession(userId, request, reply)
        +publicUser(user)
        +markSessionMfaVerified(user)
    }
    class EntityStore {
        +list(entity, sort, limit, skip)
        +filter(entity, filter, sort, limit, skip)
        +get(entity, id)
        +create(entity, data, actor)
        +update(entity, id, data)
        +delete(entity, id)
    }
    class FunctionRunner {
        +invokeInternal(name, body, actor)
        +registerFunctionRoutes(app)
    }
    class PlatformClient {
        +auth.me()
        +entities
        +asServiceRole
        +integrations.Core.SendEmail()
    }
    class ModuleSettings {
        +getModuleConfig(id)
        +MODULE_DEFINITIONS
    }
    class PublicApi {
        +apiIdentity(request)
        +tokenHasScope(identity, scope)
        +registerPublicApiRoutes(app)
    }
    class McpServer {
        +registerMcpRoutes(app)
        +authenticateMcp(request)
        +issueTokens(options)
    }
    class BackupService {
        +createBackup(options)
        +listBackups(limit)
        +runScheduledBackup()
    }
    class User {
        +uuid id
        +citext email
        +role user_staff_admin
        +status pending_active_disabled
        +jsonb metadata
    }
    class EntityRecord {
        +uuid id
        +text entity_type
        +jsonb data
        +created_by_id
        +created_by_email
    }
    class ApiToken {
        +token_hash
        +scopes
        +allowed_hostnames
        +allowed_record_types
        +expires_at
    }
    class DnsRecord {
        +name
        +record_type
        +content
        +ttl
        +proxied
        +owner_id
    }
    FastifyApp --> AuthService : registers
    FastifyApp --> EntityStore : via entity routes
    FastifyApp --> FunctionRunner : registers
    FastifyApp --> PublicApi : registers
    FastifyApp --> McpServer : registers
    FunctionRunner --> PlatformClient : binds actor
    PlatformClient --> EntityStore : uses
    PublicApi --> EntityStore : token and data access
    PublicApi --> FunctionRunner : delegates writes
    McpServer --> EntityStore : reads bundles
    McpServer --> FunctionRunner : approves/rejects
    BackupService --> ModuleSettings : reads R2 config
    EntityStore --> User : serializes
    EntityStore --> EntityRecord : serializes
    EntityRecord <|-- ApiToken
    EntityRecord <|-- DnsRecord
```

## Notes

- `ApiToken` and `DnsRecord` are JSONB entity records, not SQL tables of those exact names.
- `User` is a relational table and receives special handling in `store.js`.
- `PlatformClient` is a request-bound adapter so function handlers can use auth/entities/integrations consistently.
