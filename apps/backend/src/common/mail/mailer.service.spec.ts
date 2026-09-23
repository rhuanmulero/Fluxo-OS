import { MailerService } from './mailer.service';

describe('MailerService', () => {
  it('envia usando o remetente configurado', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const mailer = new MailerService({ sendMail }, 'Fluxo <nao-responda@fluxo.app>');

    await mailer.send({
      to: 'pessoa@exemplo.com',
      subject: 'Redefinir senha',
      html: '<p>link</p>',
      text: 'link',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Fluxo <nao-responda@fluxo.app>',
      to: 'pessoa@exemplo.com',
      subject: 'Redefinir senha',
      html: '<p>link</p>',
      text: 'link',
    });
  });

  it('propaga a falha do transporte', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('conexão recusada'));
    const mailer = new MailerService({ sendMail }, 'Fluxo <x@y.z>');

    await expect(
      mailer.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' }),
    ).rejects.toThrow('conexão recusada');
  });
});
