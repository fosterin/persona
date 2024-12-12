/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { createApp, createDatabase, createTables } from '../helpers.js'
import { EmailVerificationToken } from '../../src/email_management/email_verification_token.js'

const { models, actions } = createApp()

test.group('Manage email | createUser', () => {
  test('create new user with an unverified email address', async ({ assert }) => {
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

    assert.equal(token.email, user.unverifiedEmail)
    assert.exists(token.value)
    assert.equal(token.tokenableId, user.id)
  })

  test('throw error when email is in use', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      password: 'secret',
    })

    assert.rejects(() =>
      db.transaction(async (trx) => {
        await models.User.create(
          {
            username: 'virk',
            email: 'virk@adonisjs.com',
            unverifiedEmail: 'virk@adonisjs.com',
            password: 'secret',
          },
          { client: trx }
        )
      })
    )
  })
})

test.group('Manage email | updateEmail', () => {
  test('update both primary and unverified email for a new user account', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      password: 'secret',
    })

    const newEmail = 'foo@bar.com'
    const response = await actions.updateUserEmail(user, newEmail)
    assert.equal(response.type, 'ISSUED_TOKEN')
    assert.instanceOf(response.token, EmailVerificationToken)

    await user.refresh()
    assert.equal(user.email, newEmail)
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('noop when email has not been changed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      password: 'secret',
    })

    const newEmail = 'virk@adonisjs.com'
    const response = await actions.updateUserEmail(user, newEmail)
    assert.equal(response.type, 'SKIPPED')

    await user.refresh()

    assert.equal(user.email, newEmail)
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('noop when unverified has not been changed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })

    const newEmail = 'foo@bar.com'
    const response = await actions.updateUserEmail(user, newEmail)
    assert.equal(response.type, 'SKIPPED')

    await user.refresh()

    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('noop when email unverified email has not changed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })

    const newEmail = 'foo@bar.com'
    const response = await actions.updateUserEmail(user, newEmail)
    assert.equal(response.type, 'SKIPPED')

    await user.refresh()

    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('revert when email has changed to the primary email', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })

    const newEmail = 'virk@adonisjs.com'
    const response = await actions.updateUserEmail(user, newEmail)
    assert.equal(response.type, 'REVERTED')

    await user.refresh()

    assert.equal(user.email, 'virk@adonisjs.com')
    assert.isNull(user.unverifiedEmail)
  })

  /**
   * We can claim another user's primary email, because the new
   * email is added to the "unverified_email" column which
   * does not have a unique constraint.
   *
   * Yes, we can check for primary emails before doing the update.
   * But that does not protect from situations where a primary
   * email gets added to the table afterwards.
   *
   * In short, we can have duplicate emails inside the "unverified_email"
   * column and there is no simple way to prevent that.
   *
   * However, during verification, the claim to make "unverified_email"
   * a primary email will fail because of the unique constraint.
   *
   * In that case, a new account can sit on an unverified email for
   * very long and therefore one must delete inactive signups from
   * the user's table.
   *
   * Github is also prone to this even at a higher level that they lock
   * secondary unverified emails to be used for new signups.
   * https://github.com/orgs/community/discussions/23521
   */
  test('claim another user primary email as unverified email', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })
    await models.User.create({
      username: 'romain',
      email: 'romain@adonisjs.com',
      password: 'secret',
    })

    const newEmail = 'romain@adonisjs.com'
    const response = await actions.updateUserEmail(user, newEmail)
    assert.equal(response.type, 'ISSUED_TOKEN')
    assert.instanceOf(response.token, EmailVerificationToken)

    await user.refresh()
    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, newEmail)
  })

  test('delete verification tokens when email is reverted back', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: null,
      password: 'secret',
    })

    /**
     * Issued a new token but never verified the email
     */
    const issueTokenResponse = await actions.updateUserEmail(user, 'foo@bar.com')
    assert.equal(issueTokenResponse.type, 'ISSUED_TOKEN')

    await user.refresh()
    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, 'foo@bar.com')

    assert.lengthOf(await models.User.emailVerificationTokens.all(user), 1)

    /**
     * Reverted back to original verified email
     */
    const revertResponse = await actions.updateUserEmail(user, 'virk@adonisjs.com')
    assert.equal(revertResponse.type, 'REVERTED')

    await user.refresh()
    assert.equal(user.email, 'virk@adonisjs.com')
    assert.isNull(user.unverifiedEmail)

    assert.lengthOf(await models.User.emailVerificationTokens.all(user), 0)
  })

  test('re-issue token for every email switch', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: null,
      password: 'secret',
    })

    /**
     * Issued a new token but never verified the email
     */
    const issueTokenResponse = await actions.updateUserEmail(user, 'foo@bar.com')
    assert.equal(issueTokenResponse.type, 'ISSUED_TOKEN')

    await user.refresh()
    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, 'foo@bar.com')

    const firstToken = await models.User.emailVerificationTokens.find(
      user,
      issueTokenResponse.token!.identifier
    )

    /**
     * Switched email again
     */
    const issueTokenResponse2 = await actions.updateUserEmail(user, 'bar@baz.com')
    assert.equal(issueTokenResponse2.type, 'ISSUED_TOKEN')

    await user.refresh()
    assert.equal(user.email, 'virk@adonisjs.com')
    assert.equal(user.unverifiedEmail, 'bar@baz.com')

    const secondToken = await models.User.emailVerificationTokens.find(
      user,
      issueTokenResponse2.token!.identifier
    )

    assert.notEqual(secondToken!.hash, firstToken!.hash)
    assert.notEqual(secondToken!.email, firstToken!.email)
    assert.equal(secondToken!.tokenableId, firstToken!.tokenableId)

    /**
     * Only one token is kept within the database
     */
    assert.lengthOf(await models.User.emailVerificationTokens.all(user), 1)
  })
})

test.group('Manage email | regenerate verification token', () => {
  test('re-generate tokens', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })

    const firstToken = await user.createEmailVerificationToken()
    const secondToken = await user.createEmailVerificationToken()
    const thirdToken = await user.createEmailVerificationToken()

    assert.notEqual(firstToken.identifier, secondToken.identifier)
    assert.notEqual(firstToken.identifier, thirdToken.identifier)
    assert.lengthOf(await models.User.emailVerificationTokens.all(user), 3)
  })

  test('do not re-generate tokens within throttle window', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    const user = await models.User.create({
      username: 'virk',
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'foo@bar.com',
      password: 'secret',
    })

    const firstToken = await user.createEmailVerificationToken(true, '1min')
    const secondToken = await user.createEmailVerificationToken(true, '1min')
    const thirdToken = await user.createEmailVerificationToken(true, '1min')

    assert.isNotNull(firstToken)
    assert.isNull(secondToken)
    assert.isNull(thirdToken)

    assert.lengthOf(await models.User.emailVerificationTokens.all(user), 1)
  })
})
