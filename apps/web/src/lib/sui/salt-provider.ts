export interface SaltProvider {
  getSalt(jwt: string): Promise<string>;
}

export class MystenSaltProvider implements SaltProvider {
  private readonly url = 'https://salt.api.mystenlabs.com/get_salt';

  async getSalt(jwt: string): Promise<string> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: jwt }),
    });
    if (!res.ok) {
      throw new Error(`Salt server error: ${res.status}`);
    }
    const data = await res.json();
    return data.salt;
  }
}

export function createSaltProvider(): SaltProvider {
  const provider = process.env.NEXT_PUBLIC_SALT_PROVIDER ?? 'mysten';
  switch (provider) {
    case 'mysten':
      return new MystenSaltProvider();
    default:
      return new MystenSaltProvider();
  }
}
