/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { createApp, createDatabase, createTables } from '../../helpers.js'

const { models, actions } = createApp()

test.group('Reset password', () => {
  test('reset password of a newly created account', async ({ assert }) => {
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

      const newToken = await newUser.createPasswordResetToken()
      return { token: newToken, user: newUser }
    })

    await actions.resetPassword(token.value!.release(), 'secret@123')
    await user.refresh()

    assert.equal(user.password, 'secret@123')
    assert.lengthOf(await models.User.passwordResetTokens.all(user), 0)
  })

  test('reset password using any one of the issued tokens', async ({ assert }) => {
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

      const newToken = await newUser.createPasswordResetToken()
      return { token: newToken, user: newUser }
    })

    await user.createPasswordResetToken()
    await user.createPasswordResetToken()

    await actions.resetPassword(token.value!.release(), 'secret@123')
    await user.refresh()

    assert.equal(user.password, 'secret@123')
    assert.lengthOf(await models.User.passwordResetTokens.all(user), 0)
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

      const newToken = await newUser.createPasswordResetToken()
      return { token: newToken, user: newUser }
    })

    await user.clearPasswordResetTokens()
    await assert.rejects(
      () => actions.resetPassword(token.value!.release(), 'secret@123'),
      'Invalid or expired password reset token'
    )
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

      const newToken = await newUser.createPasswordResetToken()
      return { token: newToken, user: newUser }
    })

    await user.delete()
    await assert.rejects(
      () => actions.resetPassword(token.value!.release(), 'secret@123'),
      'Invalid or expired password reset token'
    )
  })
})
