interface CachedToken {
  value: string;
  expiresAt: number;
}

interface WorkspaceTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface DatabaseCredentialResponse {
  token: string;
  expire_time?: string;
}

const REFRESH_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_LIFETIME_MS = 60 * 60 * 1000;

export class LakebaseTokenProvider {
  private workspaceToken?: CachedToken;
  private databaseToken?: CachedToken;
  private workspaceRefresh?: Promise<CachedToken>;
  private databaseRefresh?: Promise<CachedToken>;

  constructor(
    private readonly host: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly endpointName: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async getDatabaseCredential(): Promise<string> {
    if (this.isFresh(this.databaseToken)) {
      return this.databaseToken.value;
    }

    this.databaseRefresh ??= this.refreshDatabaseToken().finally(() => {
      this.databaseRefresh = undefined;
    });

    this.databaseToken = await this.databaseRefresh;
    return this.databaseToken.value;
  }

  private async getWorkspaceToken(): Promise<string> {
    if (this.isFresh(this.workspaceToken)) {
      return this.workspaceToken.value;
    }

    this.workspaceRefresh ??= this.refreshWorkspaceToken().finally(() => {
      this.workspaceRefresh = undefined;
    });

    this.workspaceToken = await this.workspaceRefresh;
    return this.workspaceToken.value;
  }

  private async refreshWorkspaceToken(): Promise<CachedToken> {
    const basicCredentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await this.fetchImplementation(`${this.normalizedHost()}/oidc/v1/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=all-apis',
    });

    if (!response.ok) {
      throw new Error(`Databricks workspace OAuth failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as WorkspaceTokenResponse;
    if (!payload.access_token) {
      throw new Error('Databricks workspace OAuth response did not include an access token.');
    }

    return {
      value: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };
  }

  private async refreshDatabaseToken(): Promise<CachedToken> {
    const workspaceToken = await this.getWorkspaceToken();
    const response = await this.fetchImplementation(
      `${this.normalizedHost()}/api/2.0/postgres/credentials`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${workspaceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint: this.endpointName }),
      },
    );

    if (!response.ok) {
      throw new Error(`Lakebase credential generation failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as DatabaseCredentialResponse;
    if (!payload.token) {
      throw new Error('Lakebase credential response did not include a token.');
    }

    const parsedExpiry = payload.expire_time ? Date.parse(payload.expire_time) : Number.NaN;
    return {
      value: payload.token,
      expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + DEFAULT_LIFETIME_MS,
    };
  }

  private isFresh(token?: CachedToken): token is CachedToken {
    return Boolean(token && token.expiresAt - Date.now() > REFRESH_WINDOW_MS);
  }

  private normalizedHost(): string {
    return this.host.replace(/\/$/, '');
  }
}
