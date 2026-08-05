// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { LakebaseTokenProvider } from './lakebase-token.js';

describe('LakebaseTokenProvider', () => {
  it('exchanges service-principal OAuth for a cached database credential', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'workspace-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'database-token' }), { status: 200 }));
    const provider = new LakebaseTokenProvider(
      'https://workspace.databricks.com/',
      'client-id',
      'client-secret',
      'projects/project/branches/production/endpoints/endpoint',
      fetchMock,
    );

    await expect(provider.getDatabaseCredential()).resolves.toBe('database-token');
    await expect(provider.getDatabaseCredential()).resolves.toBe('database-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://workspace.databricks.com/oidc/v1/token');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://workspace.databricks.com/api/2.0/postgres/credentials');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({
      endpoint: 'projects/project/branches/production/endpoints/endpoint',
    }));
  });

  it('surfaces OAuth failures without exposing credentials', async () => {
    const provider = new LakebaseTokenProvider(
      'https://workspace.databricks.com',
      'client-id',
      'super-secret',
      'endpoint',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );

    await expect(provider.getDatabaseCredential()).rejects.toThrow('status 401');
    await expect(provider.getDatabaseCredential()).rejects.not.toThrow('super-secret');
  });
});
