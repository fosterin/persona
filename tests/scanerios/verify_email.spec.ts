/*
 * @fosterin/persona
 *
 * (C) Foster Studio
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { createApp, createDatabase, createTables } from '../helpers.js'

const { models, actions } = createApp()

test.group('Verify email', () => {
  test('verify email of a new user account', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const { token, user } = await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'virk',
          email: 'virk@adonisjs.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    await actions.verifyEmail(token.value!.release())
    await user.refresh()

    assert.isNull(user.unverifiedEmail)
    assert.equal(user.email, 'virk@adonisjs.com')

    assert.lengthOf(await models.User.emailVerificationTokens.all(user), 0)
  })

  test('verify email using any one of the issued tokens', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const { token, user } = await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'virk',
          email: 'virk@adonisjs.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    await user.createEmailVerificationToken()
    await user.createEmailVerificationToken()

    await actions.verifyEmail(token.value!.release())
    await user.refresh()

    assert.isNull(user.unverifiedEmail)
    assert.equal(user.email, 'virk@adonisjs.com')

    assert.lengthOf(await models.User.emailVerificationTokens.all(user), 0)
  })

  test('throw error when token is invalid', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const { token, user } = await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'virk',
          email: 'virk@adonisjs.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    await user.clearEmailVerificationTokens()
    await assert.rejects(
      () => actions.verifyEmail(token.value!.release()),
      'Invalid or expired email verification token'
    )
  })

  test('throw error when email is taken by another user', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const { token, user } = await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'virk',
          email: 'virk@adonisjs.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    const { token: token2 } = await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'foo',
          email: 'foo@bar.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    await actions.verifyEmail(token.value!.release())
    await user.refresh()

    assert.equal(user.email, 'virk@adonisjs.com')
    assert.isNull(user.unverifiedEmail)

    await assert.rejects(
      () => actions.verifyEmail(token2.value!.release()),
      'Invalid or expired email verification token'
    )
  })

  test('do not throw error when email is part of unverifiedEmail of another user', async ({
    assert,
  }) => {
    const db = await createDatabase()
    await createTables(db)

    const { token, user } = await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'virk',
          email: 'bar@baz.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'foo',
          email: 'foo@bar.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    await actions.verifyEmail(token.value!.release())
    await user.refresh()

    assert.equal(user.email, 'virk@adonisjs.com')
    assert.isNull(user.unverifiedEmail)
  })

  test('throw error when user does not exist for the token', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const { token, user } = await db.transaction(async (trx) => {
      const newUser = await models.User.create(
        {
          username: 'virk',
          email: 'virk@adonisjs.com',
          unverifiedEmail: 'virk@adonisjs.com',
          password: 'secret',
        },
        { client: trx }
      )

      const newToken = await newUser.createEmailVerificationToken()
      return { token: newToken, user: newUser }
    })

    await user.delete()
    await assert.rejects(
      () => actions.verifyEmail(token.value!.release()),
      'Invalid or expired email verification token'
    )
  })
})
