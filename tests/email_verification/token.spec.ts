/*
 * @fosterin/persona
 *
 * (C) Foster Studio
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Secret, base64 } from '@poppinss/utils'

import { freezeTime } from '../helpers.js'
import { EmailVerificationToken } from '../../src/email_verification/token.js'

test.group('EmailVerificationToken token | decode', () => {
  test('decode "{input}" as token')
    .with([
      {
        input: null,
        output: null,
      },
      {
        input: '',
        output: null,
      },
      {
        input: '..',
        output: null,
      },
      {
        input: 'foobar',
        output: null,
      },
      {
        input: 'foo.baz',
        output: null,
      },
      {
        input: `bar.${base64.urlEncode('baz')}`,
        output: null,
      },
      {
        input: `${base64.urlEncode('baz')}.bar`,
        output: null,
      },
      {
        input: `${base64.urlEncode('bar')}.${base64.urlEncode('baz')}`,
        output: {
          identifier: 'bar',
          secret: 'baz',
        },
      },
    ])
    .run(({ assert }, { input, output }) => {
      const decoded = EmailVerificationToken.decode(input as string)
      if (!decoded) {
        assert.deepEqual(decoded, output)
      } else {
        assert.deepEqual(
          { identifier: decoded.identifier, secret: decoded.secret.release() },
          output
        )
      }
    })
})

test.group('EmailVerificationToken token | create', () => {
  test('create a transient token', ({ assert }) => {
    freezeTime()
    const date = new Date()
    const expiresAt = new Date()
    expiresAt.setSeconds(date.getSeconds() + 60 * 20)

    const token = EmailVerificationToken.createTransientToken(1, 40, '20 mins')
    assert.equal(token.userId, 1)
    assert.exists(token.hash)
    assert.equal(token.expiresAt!.getTime(), expiresAt.getTime())
    assert.instanceOf(token.secret, Secret)
  })

  test('create token from persisted information', ({ assert }) => {
    const createdAt = new Date()
    const expiresAt = new Date()
    expiresAt.setSeconds(createdAt.getSeconds() + 60 * 20)

    const token = new EmailVerificationToken({
      identifier: '12',
      email: 'foo@bar.com',
      tokenableId: 1,
      hash: '1234',
      createdAt,
      expiresAt,
    })

    assert.equal(token.identifier, '12')
    assert.equal(token.hash, '1234')
    assert.equal(token.tokenableId, 1)
    assert.equal(token.createdAt.getTime(), createdAt.getTime())
    assert.equal(token.expiresAt!.getTime(), expiresAt.getTime())

    assert.isUndefined(token.value)
    assert.isFalse(token.isExpired())
  })

  test('create token with a secret', ({ assert }) => {
    const createdAt = new Date()
    const expiresAt = new Date()
    expiresAt.setSeconds(createdAt.getSeconds() + 60 * 20)

    const transientToken = EmailVerificationToken.createTransientToken(1, 40, '20 mins')

    const token = new EmailVerificationToken({
      identifier: '12',
      email: 'foo@bar.com',
      tokenableId: 1,
      hash: transientToken.hash,
      createdAt,
      expiresAt,
      secret: transientToken.secret,
    })

    const decoded = EmailVerificationToken.decode(token.value!.release())

    assert.equal(token.identifier, '12')
    assert.equal(token.tokenableId, 1)
    assert.equal(token.hash, transientToken.hash)
    assert.instanceOf(token.value, Secret)
    assert.isTrue(token.verify(transientToken.secret))
    assert.isTrue(token.verify(decoded!.secret))
    assert.equal(token.createdAt.getTime(), createdAt.getTime())
    assert.equal(token.expiresAt!.getTime(), expiresAt.getTime())
    assert.isFalse(token.isExpired())
  })

  test('verify token hash', ({ assert }) => {
    const transientToken = EmailVerificationToken.createTransientToken(1, 40, '20 mins')

    const token = new EmailVerificationToken({
      identifier: '12',
      email: 'foo@bar.com',
      tokenableId: 1,
      hash: transientToken.hash,
      createdAt: new Date(),
      expiresAt: new Date(),
      secret: transientToken.secret,
    })

    assert.isTrue(token.verify(transientToken.secret))
  })
})
