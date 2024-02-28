/*
 * @fosterin/persona
 *
 * (c) FosterIn
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { createDatabase, createTables } from '../helpers.js'
import { EmailVerificationToken } from '../../src/email_verification/token.js'
import { withEmailManagement } from '../../src/email_verification/mixins/with_email_management.js'

class User extends compose(BaseModel, withEmailManagement()) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare username: string

  @column()
  declare password: string
}

/**
 * The same logic will be used inside the starter kit
 */
async function updateUser(user: User, newEmail: string) {
  return await user.lockForUpdate(async (freshUser) => {
    if (!freshUser.hasEmailChanged(newEmail)) {
      await freshUser.save()
      return {
        type: 'SKIPPED',
      } as const
    }

    if (freshUser.hasEmailReverted(newEmail)) {
      freshUser.email = newEmail
      freshUser.unverifiedEmail = null
      await freshUser.clearEmailVerificationTokens()
      await freshUser.save()
      return {
        type: 'REVERTED',
      } as const
    }

    await freshUser.withEmail(newEmail).save()
    await freshUser.clearEmailVerificationTokens()
    const freshToken = await freshUser.createEmailVerificationToken(false)
    return {
      type: 'ISSUED_TOKEN',
      token: freshToken,
    } as const
  })
}

test.group('Manage email | createUser', () => {
  test('create new user with an unverified email address', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const { token, user } = await db.transaction(async (trx) => {
      const newUser = await User.create(
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

    assert.equal(token.email, user.unverifiedEmail)
    assert.exists(token.value)
    assert.equal(token.tokenableId, user.id)
  })

  test('throw error when email is in use', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    await User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      password: 'secret',
    })

    assert.rejects(() =>
      db.transaction(async (trx) => {
        const newUser = await User.create(
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
    )
  })
})

test.group('Manage email | updateUser', () => {
  test('update both primary and unverified email for a new user account', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      password: 'secret',
    })

    const newEmail = 'foo@bar.com'
    const response = await updateUser(user, newEmail)
    assert.equal(response.type, 'ISSUED_TOKEN')
    assert.instanceOf(response.token, EmailVerificationToken)

    await user.refresh()
    assert.equal(user.email, newEmail)
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('noop when email has not been changed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      password: 'secret',
    })

    const newEmail = 'virk@adonisjs.com'
    const response = await updateUser(user, newEmail)
    assert.equal(response.type, 'SKIPPED')

    await user.refresh()

    assert.equal(user.email, newEmail)
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('noop when email unverified email has not changed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })

    const newEmail = 'foo@bar.com'
    const response = await updateUser(user, newEmail)
    assert.equal(response.type, 'SKIPPED')

    await user.refresh()

    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('revert when email has changed to the primary email', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })

    const newEmail = 'virk@adonisjs.com'
    const response = await updateUser(user, newEmail)
    assert.equal(response.type, 'REVERTED')

    await user.refresh()

    assert.equal(user.email, 'virk@adonisjs.com')
    assert.isNull(user.unverifiedEmail)
  })

  /**
   * We can claim another user's primary email, because
   * the new email is added to the "unverified_email"
   * column which does not have a unique constraint.
   *
   * Yes, we can check for primary emails before doing the
   * update. But that does not protect from situations where
   * a primary email gets added to the table afterwards.
   *
   * In short, we can have duplicate emails inside the
   * "unverified_email" column and there is no direct way to prevent
   * that.
   *
   * However, during verification, the claim to make unverified_email
   * an primary email will fail because of the unique constraint.
   */
  test('claim another user primary email as unverified email', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })
    await User.create({
      username: 'romain',
      email: 'romain@adonisjs.com',
      password: 'secret',
    })

    const newEmail = 'romain@adonisjs.com'
    const response = await updateUser(user, newEmail)
    assert.equal(response.type, 'ISSUED_TOKEN')
    assert.instanceOf(response.token, EmailVerificationToken)

    await user.refresh()
    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, newEmail)
  })
})
