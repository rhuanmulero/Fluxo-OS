import { GeminiService } from './gemini.service';

describe('Cliente Gemini', () => {
  afterEach(() => jest.restoreAllMocks());
  it('envia chave no header, histórico em ordem e omite pensamentos', async () => {
    const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'interno', thought: true }, { text: 'Resposta' }] } }] })));
    expect(await new GeminiService().reply('secret', 'gemini-test', [{ role: 'user', content: 'Olá' }])).toBe('Resposta');
    const [url, request] = mock.mock.calls[0]!;
    expect(String(url)).not.toContain('secret');
    expect(request?.headers).toEqual(expect.objectContaining({ 'x-goog-api-key': 'secret' }));
    expect(JSON.parse(String(request?.body)) as unknown).toEqual(expect.objectContaining({ contents: [{ role: 'user', parts: [{ text: 'Olá' }] }] }));
  });
  it.each([400, 403, 404, 429, 503])('trata erro HTTP %s sem expor a resposta do provedor', async status => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret', { status }));
    await expect(new GeminiService().reply('secret', 'gemini-test', [])).rejects.not.toThrow('secret');
  });
  it('trata resposta bloqueada ou vazia', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await expect(new GeminiService().reply('secret', 'gemini-test', [])).rejects.toThrow('não retornou');
  });
  it('trata timeout ou indisponibilidade', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(new GeminiService().reply('secret', 'gemini-test', [])).rejects.toThrow('indisponível');
  });
});
